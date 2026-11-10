import type { ProductCode, StockSalePumpReading, StockSaleReport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPumpDefinitions } from "./equipment";
import { calculatePumpSales, sumSalesByProduct } from "./pump-calc";
import { sumActiveRttByPumpKey } from "./rtt";
import { StockReportingError } from "./service";

const FUEL: ProductCode[] = ["PMS", "AGO"];

export async function ensureStationPumps(stationId: string) {
  const defs = defaultPumpDefinitions();
  const existing = await prisma.stationPump.findMany({ where: { stationId } });
  const byKey = new Map(existing.map((p) => [p.pumpKey, p]));

  for (const d of defs) {
    const row = byKey.get(d.pumpKey);
    if (!row) {
      try {
        await prisma.stationPump.create({
          data: {
            stationId,
            pumpKey: d.pumpKey,
            product: d.product,
            label: d.label,
            sortOrder: d.sortOrder,
            lastClosingLitres: 0,
            active: true,
          },
        });
      } catch (err) {
        // Concurrent ensure — unique (stationId, pumpKey) already satisfied.
        if (
          !(
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code?: string }).code === "P2002"
          )
        ) {
          throw err;
        }
      }
    } else if (!row.active) {
      await prisma.stationPump.update({
        where: { id: row.id },
        data: {
          active: true,
          product: d.product,
          label: d.label,
          sortOrder: d.sortOrder,
        },
      });
    }
  }

  return prisma.stationPump.findMany({
    where: { stationId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function ensurePumpReadingsForReport(reportId: string, stationId: string) {
  const pumps = await ensureStationPumps(stationId);
  const report = await prisma.stockSaleReport.findUnique({
    where: { id: reportId },
    select: { reportingDate: true },
  });
  if (!report) throw new StockReportingError("Report not found.", "NOT_FOUND");

  const existing = await prisma.stockSalePumpReading.findMany({ where: { reportId } });
  const have = new Set(existing.map((r) => r.pumpKey));
  const rttByPump = await sumActiveRttByPumpKey({
    stationId,
    reportingDate: report.reportingDate,
  });

  const missing = pumps.filter((p) => FUEL.includes(p.product) && !have.has(p.pumpKey));
  if (missing.length) {
    await prisma.stockSalePumpReading.createMany({
      data: missing.map((p) => ({
        reportId,
        pumpKey: p.pumpKey,
        product: p.product,
        label: p.label,
        sortOrder: p.sortOrder,
        openingLitres: p.meterInitialized ? p.lastClosingLitres : 0,
        closingLitres: null,
        rttLitres: rttByPump.get(p.pumpKey) ?? 0,
        salesLitres: null,
      })),
      skipDuplicates: true,
    });
  }

  // Keep RTT Applied in sync with live RTT module events (draft reports only).
  const rows = await prisma.stockSalePumpReading.findMany({ where: { reportId } });
  for (const row of rows) {
    const rtt = rttByPump.get(row.pumpKey) ?? 0;
    if (row.rttLitres !== rtt && row.closingLitres == null) {
      await prisma.stockSalePumpReading.update({
        where: { id: row.id },
        data: { rttLitres: rtt },
      });
    } else if (row.rttLitres !== rtt && row.closingLitres != null) {
      const calc = calculatePumpSales({
        opening: row.openingLitres,
        closing: row.closingLitres,
        rtt,
      });
      await prisma.stockSalePumpReading.update({
        where: { id: row.id },
        data: {
          rttLitres: rtt,
          salesLitres: calc.ok ? calc.sales : null,
        },
      });
    }
  }

  return prisma.stockSalePumpReading.findMany({
    where: { reportId },
    orderBy: { sortOrder: "asc" },
  });
}

export type PumpReadingInput = {
  pumpKey: string;
  closingLitres: number | null;
  /** Ignored — RTT is applied from StationPumpRttEvent aggregation. */
  rttLitres?: number;
  /** Only accepted when the pump has not yet been meter-initialized. */
  openingLitres?: number | null;
};

export type SavePumpMetersMode = "draft" | "complete";

export async function savePumpMeterReadings(params: {
  dealerOrganizationId: string;
  reportId: string;
  expectedRevision: number;
  readings: PumpReadingInput[];
  mode: SavePumpMetersMode;
}) {
  const report = await prisma.stockSaleReport.findUnique({
    where: { id: params.reportId },
    include: { pumpReadings: true },
  });
  if (!report || report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "NOT_FOUND");
  }
  if (report.status === "CLOSED") {
    throw new StockReportingError("Closed reports cannot be edited.", "CLOSED");
  }
  if (report.revision !== params.expectedRevision) {
    throw new StockReportingError(
      "This report was updated elsewhere. Refresh and try again.",
      "CONFLICT"
    );
  }

  const pumps = await ensureStationPumps(report.stationId);
  const pumpMeta = new Map(pumps.map((p) => [p.pumpKey, p]));
  const rttByPump = await sumActiveRttByPumpKey({
    stationId: report.stationId,
    reportingDate: report.reportingDate,
  });

  const byKey = new Map(params.readings.map((r) => [r.pumpKey, r]));
  const fieldErrors: Record<string, string> = {};
  const computed: {
    pumpKey: string;
    openingLitres: number;
    closingLitres: number | null;
    rttLitres: number;
    salesLitres: number | null;
    product: string;
    initializeMeter: boolean;
  }[] = [];

  for (const row of report.pumpReadings) {
    const input = byKey.get(row.pumpKey);
    const meta = pumpMeta.get(row.pumpKey);
    const needsInit = !(meta?.meterInitialized ?? true);
    const opening =
      needsInit && input?.openingLitres != null ? input.openingLitres : row.openingLitres;
    const closing = input?.closingLitres ?? null;
    const rtt = rttByPump.get(row.pumpKey) ?? 0;

    if (needsInit && params.mode === "complete") {
      if (input?.openingLitres == null) {
        fieldErrors[`${row.pumpKey}.opening`] = "Initial opening meter is required.";
        continue;
      }
      if (input.openingLitres < 0) {
        fieldErrors[`${row.pumpKey}.opening`] = "Opening meter must be nonnegative.";
        continue;
      }
    }

    if (params.mode === "complete") {
      if (closing == null) {
        fieldErrors[`${row.pumpKey}.closing`] = "Closing meter is required.";
        continue;
      }
      const calc = calculatePumpSales({ opening, closing, rtt });
      if (!calc.ok) {
        fieldErrors[`${row.pumpKey}.closing`] = calc.error;
        continue;
      }
      computed.push({
        pumpKey: row.pumpKey,
        openingLitres: opening,
        closingLitres: closing,
        rttLitres: rtt,
        salesLitres: calc.sales,
        product: row.product,
        initializeMeter: needsInit,
      });
    } else if (closing != null) {
      const calc = calculatePumpSales({ opening, closing, rtt });
      if (!calc.ok) {
        fieldErrors[`${row.pumpKey}.closing`] = calc.error;
        continue;
      }
      computed.push({
        pumpKey: row.pumpKey,
        openingLitres: opening,
        closingLitres: closing,
        rttLitres: rtt,
        salesLitres: calc.sales,
        product: row.product,
        initializeMeter: needsInit,
      });
    } else {
      computed.push({
        pumpKey: row.pumpKey,
        openingLitres: opening,
        closingLitres: null,
        rttLitres: rtt,
        salesLitres: null,
        product: row.product,
        initializeMeter: needsInit,
      });
    }
  }

  if (Object.keys(fieldErrors).length) {
    throw new StockReportingError(
      "Please fix the highlighted pump readings.",
      "VALIDATION",
      fieldErrors
    );
  }

  const totals = sumSalesByProduct(
    computed.map((c) => ({ product: c.product, sales: c.salesLitres }))
  );

  const updated = await prisma.$transaction(async (tx) => {
    for (const row of computed) {
      await tx.stockSalePumpReading.update({
        where: {
          reportId_pumpKey: { reportId: report.id, pumpKey: row.pumpKey },
        },
        data: {
          openingLitres: row.openingLitres,
          closingLitres: row.closingLitres,
          rttLitres: row.rttLitres,
          salesLitres: row.salesLitres,
        },
      });
    }

    const data: Record<string, unknown> = {
      revision: { increment: 1 },
      meterSalesPmsLitres: totals.pms,
      meterSalesAgoLitres: totals.ago,
      totalSalesLitres: totals.total,
      // Source changes invalidate wet + monetary reconciliation decisions.
      wetStockCompletedAt: null,
      wetResolution: "NONE",
      wetState: "NOT_STARTED",
      wetLossReason: null,
      wetLossAcknowledgedAt: null,
      wetLossAcknowledgedById: null,
      monetaryCompletedAt: null,
      expectedRevenueKes: null,
      expectedPmsKes: null,
      expectedAgoKes: null,
      collectionsKes: null,
      cashCollectionsKes: null,
      mpesaCollectionsKes: null,
      cardCollectionsKes: null,
      monetaryDifferenceKes: null,
      monetaryState: "NOT_STARTED",
      monetaryDiscrepancyReason: null,
      sellingPricePmsKes: null,
      sellingPriceAgoKes: null,
    };

    if (params.mode === "complete") {
      data.pumpMetersCompletedAt = new Date();
      for (const row of computed) {
        if (row.closingLitres == null) continue;
        await tx.stationPump.updateMany({
          where: { stationId: report.stationId, pumpKey: row.pumpKey },
          data: {
            lastClosingLitres: row.closingLitres,
            meterInitialized: true,
          },
        });
      }
    }

    return tx.stockSaleReport.update({
      where: { id: report.id },
      data,
      include: { pumpReadings: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return updated;
}

export type PumpReadingRowDto = {
  id: string;
  pumpKey: string;
  product: "PMS" | "AGO";
  label: string;
  openingLitres: number;
  closingLitres: number | null;
  rttLitres: number;
  salesLitres: number | null;
  needsOpeningInit: boolean;
};

export function toPumpReadingDto(
  row: StockSalePumpReading,
  needsOpeningInit = false
): PumpReadingRowDto {
  return {
    id: row.id,
    pumpKey: row.pumpKey,
    product: row.product === "AGO" ? "AGO" : "PMS",
    label: row.label,
    openingLitres: row.openingLitres,
    closingLitres: row.closingLitres,
    rttLitres: row.rttLitres,
    salesLitres: row.salesLitres,
    needsOpeningInit,
  };
}

export async function toPumpReadingDtos(
  rows: StockSalePumpReading[],
  stationId: string
): Promise<PumpReadingRowDto[]> {
  const pumps = await ensureStationPumps(stationId);
  const initMap = new Map(pumps.map((p) => [p.pumpKey, !p.meterInitialized]));
  return rows.map((r) => toPumpReadingDto(r, initMap.get(r.pumpKey) ?? false));
}

export type PumpMetersPageModel = {
  report: StockSaleReport & { pumpReadings: StockSalePumpReading[] };
  stationName: string;
  pumpsLabel: string;
  tanksLabel: string;
  readings: PumpReadingRowDto[];
  readOnly: boolean;
};
