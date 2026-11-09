import { requireDealer } from "@/lib/session";
import { ReportRecordsPageView } from "@/components/dealer/report-records-page";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import { STOCK_REPORT_STAGE_META } from "@/lib/stock-reporting/constants";
import { nextIncompleteStage } from "@/lib/stock-reporting/progress";
import {
  listReportRecords,
  listStationsForDealer,
  pickDefaultStation,
} from "@/lib/stock-reporting/service";
import { decimalToNumber, sumNullable } from "@/lib/stock-reporting/records-export";

const PAGE_SIZE = 5;

function parseIsoDate(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function toInputDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatVolumeCell(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoneyCell(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function StockReportingRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stationId?: string;
    status?: string;
    date?: string;
    /** Legacy range params — treated as a single day when `date` is absent. */
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const sp = await searchParams;
  const stations = await listStationsForDealer(orgId);
  const station =
    stations.find((s) => s.id === sp.stationId) ?? pickDefaultStation(stations);

  const statusFilter =
    sp.status === "DRAFT" || sp.status === "CLOSED" ? sp.status : "ALL";

  const today = nairobiBusinessDate();
  const selected =
    parseIsoDate(sp.date) ?? parseIsoDate(sp.from) ?? parseIsoDate(sp.to) ?? today;
  const dateStr = toInputDate(selected);

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const result = station
    ? await listReportRecords({
        dealerOrganizationId: orgId,
        stationId: station.id,
        take: PAGE_SIZE,
        skip,
        status: statusFilter,
        dateFrom: selected,
        dateTo: selected,
      })
    : { rows: [], total: 0, take: PAGE_SIZE, skip: 0 };

  const rows = result.rows.map((r) => {
    const meter = sumNullable(r.meterSalesPmsLitres, r.meterSalesAgoLitres);
    const tank = sumNullable(r.tankSalesPmsLitres, r.tankSalesAgoLitres);
    const pumps =
      r.status === "CLOSED"
        ? (r.submittedPumpCount ?? r.station.pumpCount)
        : r.station.pumpCount;
    const tanks =
      r.status === "CLOSED"
        ? (r.submittedTankCount ?? r.station.tankCount)
        : r.station.tankCount;

    return {
      id: r.id,
      reportingDateLabel: formatStockReportDate(r.reportingDate),
      pumps: pumps ?? null,
      tanks: tanks ?? null,
      meterSalesLabel: formatVolumeCell(meter ?? r.totalSalesLitres),
      tankSalesLabel: formatVolumeCell(tank),
      expectedRevenueLabel: formatMoneyCell(decimalToNumber(r.expectedRevenueKes)),
      collectionsLabel: formatMoneyCell(decimalToNumber(r.collectionsKes)),
      status: r.status as "DRAFT" | "CLOSED",
      resumeHref:
        r.status === "DRAFT" ? STOCK_REPORT_STAGE_META[nextIncompleteStage(r)].href : null,
      viewHref: `/dealer/stock-reporting/report/${r.id}/submitted`,
      detailsHref: `/dealer/stock-reporting/report/${r.id}`,
    };
  });

  return (
    <ReportRecordsPageView
      stationId={station?.id}
      stationName={station?.name ?? null}
      status={statusFilter}
      date={dateStr}
      page={page}
      pageSize={PAGE_SIZE}
      total={result.total}
      rows={rows}
    />
  );
}
