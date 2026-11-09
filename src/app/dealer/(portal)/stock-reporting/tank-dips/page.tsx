import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { TankDipsForm } from "@/components/dealer/tank-dips-form";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  formatEquipmentBreakdown,
  resolveStationEquipment,
} from "@/lib/stock-reporting/equipment";
import { isStageCompleted } from "@/lib/stock-reporting/progress";
import { ensureTankReadingsForReport, toTankReadingDto } from "@/lib/stock-reporting/tanks";
import {
  listStationsForDealer,
  pickDefaultStation,
  startTodaysReport,
} from "@/lib/stock-reporting/service";

export default async function TankDipsStagePage({
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

  if (report.status !== "CLOSED" && !isStageCompleted(report, "PUMP_METERS")) {
    redirect("/dealer/stock-reporting/pump-meters");
  }

  const readings = await ensureTankReadingsForReport(report.id, station.id);
  const equipment = resolveStationEquipment(station);
  const reportingDate = report.reportingDate ?? nairobiBusinessDate();

  return (
    <TankDipsForm
      reportId={report.id}
      revision={report.revision}
      stationName={station.name}
      reportingDateLabel={formatStockReportDate(reportingDate)}
      pumpsLabel={formatEquipmentBreakdown(equipment.pumpCount, equipment.pumpsByProduct)}
      tanksLabel={formatEquipmentBreakdown(equipment.tankCount, equipment.tanksByProduct)}
      readings={readings.map(toTankReadingDto)}
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
