import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { MonetaryForm } from "@/components/dealer/monetary-form";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  formatEquipmentBreakdown,
  resolveStationEquipment,
} from "@/lib/stock-reporting/equipment";
import { resolveSellingPrices } from "@/lib/stock-reporting/monetary";
import { isStageCompleted } from "@/lib/stock-reporting/progress";
import {
  listStationsForDealer,
  pickDefaultStation,
  startTodaysReport,
} from "@/lib/stock-reporting/service";

function decimalToNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export default async function MonetaryStagePage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const { stationId: requestedStationId } = await searchParams;

  const stations = await listStationsForDealer(orgId);
  const station =
    stations.find((s) => s.id === requestedStationId) ?? pickDefaultStation(stations);
  if (!station) redirect("/dealer/stock-reporting");

  const report = await startTodaysReport({
    dealerOrganizationId: orgId,
    stationId: station.id,
    userId: session.user.id,
  });

  if (report.status !== "CLOSED" && !isStageCompleted(report, "WET_STOCK")) {
    if (!isStageCompleted(report, "TANK_DIPS")) {
      redirect(
        isStageCompleted(report, "PUMP_METERS")
          ? "/dealer/stock-reporting/tank-dips"
          : "/dealer/stock-reporting/pump-meters"
      );
    }
    redirect("/dealer/stock-reporting/wet-stock");
  }

  const prices = resolveSellingPrices({
    stationCode: station.code,
    snapshotPms: report.sellingPricePmsKes,
    snapshotAgo: report.sellingPriceAgoKes,
  });

  const equipment = resolveStationEquipment(station);
  const reportingDate = report.reportingDate ?? nairobiBusinessDate();

  return (
    <MonetaryForm
      reportId={report.id}
      revision={report.revision}
      stationName={station.name}
      reportingDateLabel={formatStockReportDate(reportingDate)}
      pumpsLabel={formatEquipmentBreakdown(equipment.pumpCount, equipment.pumpsByProduct)}
      tanksLabel={formatEquipmentBreakdown(equipment.tankCount, equipment.tanksByProduct)}
      meterPms={report.meterSalesPmsLitres ?? 0}
      meterAgo={report.meterSalesAgoLitres ?? 0}
      totalSalesLitres={report.totalSalesLitres ?? 0}
      pricePms={prices.pms}
      priceAgo={prices.ago}
      priceNote={prices.note}
      pricesMissing={prices.source === "missing"}
      initialCash={decimalToNumber(report.cashCollectionsKes)}
      initialMpesa={decimalToNumber(report.mpesaCollectionsKes)}
      initialCard={decimalToNumber(report.cardCollectionsKes)}
      initialDiscrepancyReason={report.monetaryDiscrepancyReason}
      wetState={report.wetState}
      wetResolution={report.wetResolution}
      updatedAt={report.updatedAt.toISOString()}
      reportProgress={{
        status: report.status,
        pumpMetersCompletedAt: report.pumpMetersCompletedAt?.toISOString() ?? null,
        tankDipsCompletedAt: report.tankDipsCompletedAt?.toISOString() ?? null,
        wetStockCompletedAt: report.wetStockCompletedAt?.toISOString() ?? null,
        monetaryCompletedAt: report.monetaryCompletedAt?.toISOString() ?? null,
      }}
      readOnly={report.status === "CLOSED"}
    />
  );
}
