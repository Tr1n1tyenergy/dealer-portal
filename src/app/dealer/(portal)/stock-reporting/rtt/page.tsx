import { redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { RttCalibrationPage } from "@/components/dealer/rtt-calibration-page";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  buildRttPumpSummaries,
  listRttEventsForDate,
  listRttStationContext,
} from "@/lib/stock-reporting/rtt";
import {
  listStationsForDealer,
  pickDefaultStation,
} from "@/lib/stock-reporting/service";

export default async function StockReportingRttPage({
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
  if (!station) {
    redirect("/dealer/stock-reporting");
  }

  const reportingDate = nairobiBusinessDate();
  const ctx = await listRttStationContext({
    dealerOrganizationId: orgId,
    stationId: station.id,
  });
  const [summary, events] = await Promise.all([
    buildRttPumpSummaries({ stationId: station.id, reportingDate }),
    listRttEventsForDate({ stationId: station.id, reportingDate }),
  ]);

  return (
    <RttCalibrationPage
      stationId={station.id}
      stationName={ctx.station.name}
      reportingDateLabel={formatStockReportDate(reportingDate)}
      reportingDateIso={reportingDate.toISOString().slice(0, 10)}
      pumps={ctx.pumps}
      summaries={summary.rows}
      events={events}
      totals={{
        eventCount: summary.eventCount,
        totalPms: summary.totalPms,
        totalAgo: summary.totalAgo,
        total: summary.total,
      }}
    />
  );
}
