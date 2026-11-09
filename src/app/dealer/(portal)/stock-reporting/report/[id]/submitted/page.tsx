import { notFound, redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { StockReportSubmittedView } from "@/components/dealer/stock-report-submitted";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import { formatEquipmentBreakdown } from "@/lib/stock-reporting/equipment";
import {
  monetarySidebarStatus,
  wetSidebarStatus,
} from "@/lib/stock-reporting/reference";
import { getReportForDealer, getTodaysReport, StockReportingError } from "@/lib/stock-reporting/service";

function n(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const x = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(x) ? x : null;
}

export default async function StockReportSubmittedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const { id } = await params;

  let report;
  try {
    report = await getReportForDealer({
      dealerOrganizationId: orgId,
      reportId: id,
    });
  } catch (err) {
    if (err instanceof StockReportingError) notFound();
    throw err;
  }

  if (report.status !== "CLOSED") {
    redirect("/dealer/stock-reporting/monetary");
  }
  if (!report.reportReference) {
    redirect(`/dealer/stock-reporting/report/${report.id}`);
  }

  const pumpsLabel =
    report.submittedPumpCount != null
      ? formatEquipmentBreakdown(report.submittedPumpCount, {
          PMS: report.submittedPumpsPms ?? 0,
          AGO: report.submittedPumpsAgo ?? 0,
        })
      : "—";
  const tanksLabel =
    report.submittedTankCount != null
      ? formatEquipmentBreakdown(report.submittedTankCount, {
          PMS: report.submittedTanksPms ?? 0,
          AGO: report.submittedTanksAgo ?? 0,
        })
      : "—";

  const today = await getTodaysReport({
    dealerOrganizationId: orgId,
    stationId: report.stationId,
  });
  const todayClosed = today?.status === "CLOSED";
  const todayIsThisReport = today?.id === report.id;
  const newReportBlockedMessage =
    todayClosed || todayIsThisReport
      ? `Today’s report for ${report.station.name} is already closed (${
          today?.reportReference ?? report.reportReference
        }). A new daily report can only be started on the next Nairobi business day under the current one-report-per-day policy.`
      : null;

  return (
    <StockReportSubmittedView
      reportId={report.id}
      reportReference={report.reportReference}
      stationName={report.station.name}
      reportingDateLabel={formatStockReportDate(report.reportingDate ?? nairobiBusinessDate())}
      pumpsLabel={pumpsLabel}
      tanksLabel={tanksLabel}
      stageStatuses={[
        "Completed",
        "Completed",
        wetSidebarStatus(report.wetResolution, report.wetState),
        monetarySidebarStatus(report.monetaryState),
      ]}
      meterPms={report.meterSalesPmsLitres ?? 0}
      meterAgo={report.meterSalesAgoLitres ?? 0}
      tankPms={report.tankSalesPmsLitres ?? 0}
      tankAgo={report.tankSalesAgoLitres ?? 0}
      varianceTotal={report.wetVarianceTotalLitres}
      wetResolution={report.wetResolution}
      wetState={report.wetState}
      pricePms={n(report.sellingPricePmsKes)}
      priceAgo={n(report.sellingPriceAgoKes)}
      expectedPms={n(report.expectedPmsKes)}
      expectedAgo={n(report.expectedAgoKes)}
      expectedTotal={n(report.expectedRevenueKes)}
      cash={n(report.cashCollectionsKes)}
      mpesa={n(report.mpesaCollectionsKes)}
      card={n(report.cardCollectionsKes)}
      collectionsTotal={n(report.collectionsKes)}
      monetaryDifference={n(report.monetaryDifferenceKes)}
      monetaryState={report.monetaryState}
      newReportBlockedMessage={newReportBlockedMessage}
    />
  );
}
