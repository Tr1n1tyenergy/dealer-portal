import { NextResponse } from "next/server";
import { requireDealer } from "@/lib/session";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  decimalToNumber,
  rowsToCsv,
  rowsToSpreadsheetMl,
  sumNullable,
  type ReportRecordExportRow,
} from "@/lib/stock-reporting/records-export";
import {
  listReportRecordsForExport,
  listStationsForDealer,
  pickDefaultStation,
  StockReportingError,
} from "@/lib/stock-reporting/service";

export const runtime = "nodejs";

function parseIsoDate(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function isoStamp(d: Date): string {
  return d.toISOString();
}

export async function GET(req: Request) {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw === "DRAFT" || statusRaw === "CLOSED" ? statusRaw : "ALL";

    const stations = await listStationsForDealer(orgId);
    const station =
      stations.find((s) => s.id === url.searchParams.get("stationId")) ??
      pickDefaultStation(stations);
    if (!station) {
      return NextResponse.json({ error: "No station available." }, { status: 400 });
    }

    const today = nairobiBusinessDate();
    const selected =
      parseIsoDate(url.searchParams.get("date")) ??
      parseIsoDate(url.searchParams.get("from")) ??
      parseIsoDate(url.searchParams.get("to")) ??
      today;

    const reports = await listReportRecordsForExport({
      dealerOrganizationId: orgId,
      stationId: station.id,
      status,
      dateFrom: selected,
      dateTo: selected,
    });

    const rows: ReportRecordExportRow[] = reports.map((r) => {
      const meter = sumNullable(r.meterSalesPmsLitres, r.meterSalesAgoLitres);
      const tank = sumNullable(r.tankSalesPmsLitres, r.tankSalesAgoLitres);
      const variance =
        meter != null && tank != null ? meter - tank : (r.wetVarianceTotalLitres ?? null);
      const pumps =
        r.status === "CLOSED"
          ? (r.submittedPumpCount ?? r.station.pumpCount)
          : r.station.pumpCount;
      const tanks =
        r.status === "CLOSED"
          ? (r.submittedTankCount ?? r.station.tankCount)
          : r.station.tankCount;

      return {
        reportReference: r.reportReference ?? "",
        reportingDate: formatStockReportDate(r.reportingDate),
        station: r.station.name,
        pumps: pumps ?? "",
        tanks: tanks ?? "",
        meterSalesLitres: meter ?? r.totalSalesLitres ?? null,
        tankSalesLitres: tank,
        stockVarianceLitres: variance,
        expectedRevenueKes: decimalToNumber(r.expectedRevenueKes),
        collectionsKes: decimalToNumber(r.collectionsKes),
        monetaryDifferenceKes: decimalToNumber(r.monetaryDifferenceKes),
        status: r.status === "CLOSED" ? "Closed" : "Draft",
        createdAt: isoStamp(r.createdAt),
        updatedAt: isoStamp(r.updatedAt),
        submittedAt: r.closedAt ? isoStamp(r.closedAt) : "",
      };
    });

    const stamp = formatStockReportDate(today).replace(/\s+/g, "-");
    if (format === "xlsx") {
      const body = rowsToSpreadsheetMl(rows);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="stock-report-records-${stamp}.xls"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const body = rowsToCsv(rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stock-report-records-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof StockReportingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[stock-reporting] records export", err);
    return NextResponse.json({ error: "Could not export report records." }, { status: 500 });
  }
}
