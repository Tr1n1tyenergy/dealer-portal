import { requireDealer } from "@/lib/session";
import { formatKesAmount, formatLitres, formatProductVolumes } from "@/lib/stock-reporting/format";
import { formatStockReportDate, nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import {
  formatEquipmentBreakdown,
  resolveStationEquipment,
} from "@/lib/stock-reporting/equipment";
import { formatProductChip, stationFuelProductLabels } from "@/lib/stock-reporting/products";
import { buildStageProgress, dashboardReportStatus } from "@/lib/stock-reporting/progress";
import {
  getTodaysReport,
  listRecentReports,
  listStationsForDealer,
  pickDefaultStation,
} from "@/lib/stock-reporting/service";
import { StockReportingDashboard } from "@/components/dealer/stock-reporting-dashboard";

export default async function StockSaleReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const { stationId: requestedStationId } = await searchParams;

  let loadError: string | null = null;
  let stations: Awaited<ReturnType<typeof listStationsForDealer>> = [];
  try {
    stations = await listStationsForDealer(orgId);
  } catch (err) {
    console.error("[stock-reporting] listStationsForDealer", err);
    loadError = "Could not load station configuration. Reporting data may be incomplete.";
  }

  const station =
    stations.find((s) => s.id === requestedStationId) ?? pickDefaultStation(stations);

  const reportingDate = nairobiBusinessDate();
  let todaysReport = null;
  let recent: Awaited<ReturnType<typeof listRecentReports>> = [];

  if (station) {
    try {
      [todaysReport, recent] = await Promise.all([
        getTodaysReport({ dealerOrganizationId: orgId, stationId: station.id }),
        listRecentReports({ dealerOrganizationId: orgId, stationId: station.id, take: 5 }),
      ]);
    } catch (err) {
      console.error("[stock-reporting] load reports", err);
      loadError =
        loadError ??
        "Could not load stock reports. If this persists after a database migrate, contact support.";
    }
  }

  const productsLabel = station
    ? formatProductChip(stationFuelProductLabels(station.products))
    : "—";
  const equipment = resolveStationEquipment(station);

  return (
    <StockReportingDashboard
      module="reporting"
      stationName={station?.name ?? "No station"}
      stationId={station?.id ?? ""}
      reportingDateLabel={formatStockReportDate(reportingDate)}
      pumpsTanksLabel={`${equipment.pumpCount} Pumps · ${formatEquipmentBreakdown(
        equipment.tankCount,
        equipment.tanksByProduct
      )}`}
      productsLabel={productsLabel}
      reportStatus={dashboardReportStatus(todaysReport)}
      stages={buildStageProgress(todaysReport)}
      todaysReportId={todaysReport?.id ?? null}
      todaysRevision={todaysReport?.revision ?? null}
      recentReports={recent.map((r) => ({
        id: r.id,
        reportingDateLabel: formatStockReportDate(r.reportingDate),
        meterSales: formatProductVolumes(r.meterSalesPmsLitres, r.meterSalesAgoLitres),
        tankSales: formatProductVolumes(r.tankSalesPmsLitres, r.tankSalesAgoLitres),
        totalSales: formatLitres(r.totalSalesLitres),
        expectedRevenue: formatKesAmount(r.expectedRevenueKes),
        collections: formatKesAmount(r.collectionsKes),
        status: "Closed" as const,
      }))}
      loadError={loadError}
    />
  );
}
