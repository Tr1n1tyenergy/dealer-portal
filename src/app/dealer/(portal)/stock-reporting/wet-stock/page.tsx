import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { WetStockForm } from "@/components/dealer/wet-stock-form";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  formatEquipmentBreakdown,
  resolveStationEquipment,
} from "@/lib/stock-reporting/equipment";
import { isStageCompleted } from "@/lib/stock-reporting/progress";
import {
  listStationsForDealer,
  pickDefaultStation,
  startTodaysReport,
} from "@/lib/stock-reporting/service";
import { listEligibleStockDeliveries } from "@/lib/stock-reporting/wet";

export default async function WetStockStagePage({
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

  if (report.status !== "CLOSED" && !isStageCompleted(report, "TANK_DIPS")) {
    redirect(
      isStageCompleted(report, "PUMP_METERS")
        ? "/dealer/stock-reporting/tank-dips"
        : "/dealer/stock-reporting/pump-meters"
    );
  }

  const equipment = resolveStationEquipment(station);
  const reportingDate = report.reportingDate ?? nairobiBusinessDate();
  const deliveries = await listEligibleStockDeliveries({
    stationId: station.id,
    reportingDate,
  });

  const initialResolution =
    report.wetResolution === "MATCH_DELIVERY" ||
    report.wetResolution === "REVIEW_READINGS" ||
    report.wetResolution === "RECORD_LOSS" ||
    report.wetResolution === "BALANCED"
      ? report.wetResolution
      : "NONE";

  return (
    <WetStockForm
      reportId={report.id}
      revision={report.revision}
      stationName={station.name}
      reportingDateLabel={formatStockReportDate(reportingDate)}
      pumpsLabel={formatEquipmentBreakdown(equipment.pumpCount, equipment.pumpsByProduct)}
      tanksLabel={formatEquipmentBreakdown(equipment.tankCount, equipment.tanksByProduct)}
      meterPms={report.meterSalesPmsLitres ?? 0}
      meterAgo={report.meterSalesAgoLitres ?? 0}
      tankPms={report.tankSalesPmsLitres ?? 0}
      tankAgo={report.tankSalesAgoLitres ?? 0}
      initialResolution={initialResolution}
      initialLossReason={report.wetLossReason}
      updatedAt={report.updatedAt.toISOString()}
      reportProgress={{
        status: report.status,
        pumpMetersCompletedAt: report.pumpMetersCompletedAt?.toISOString() ?? null,
        tankDipsCompletedAt: report.tankDipsCompletedAt?.toISOString() ?? null,
        wetStockCompletedAt: report.wetStockCompletedAt?.toISOString() ?? null,
        monetaryCompletedAt: report.monetaryCompletedAt?.toISOString() ?? null,
      }}
      readOnly={report.status === "CLOSED"}
      eligibleDeliveryCount={deliveries.length}
    />
  );
}
