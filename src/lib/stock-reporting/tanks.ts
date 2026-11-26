import type { ProductCode, StockSaleTankReading } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeOpenTankDetails, writeTankClosingRows, writeTankDipRows } from "./bulk-litre-writes";
import { calculateTankDip, sumTankSalesByProduct } from "./tank-calc";
import { addLitres, onReportReceiptLitres } from "./stock-receipt";
import { StockReportingError } from "./service";

const FUEL: ProductCode[] = ["PMS", "AGO"];

/**
 * Active tanks for a station — Platform Settings → Tank Management is the source of truth.
 * Does not create, reactivate, or overwrite tanks (legacy default seeding removed).
 */
export async function ensureStationTanks(stationId: string) {
  return prisma.stationTank.findMany({
    where: { stationId, active: true },
    orderBy: [{ sortOrder: "asc" }, { tankKey: "asc" }],
  });
}

export async function ensureTankReadingsForReport(reportId: string, stationId: string) {
  const tanks = await ensureStationTanks(stationId);
  if (tanks.length === 0) {
    throw new StockReportingError(
      "No tanks configured for this station. Add tanks in Platform Settings → Tank Management.",
      "VALIDATION"
    );
  }

  const existing = await prisma.stockSaleTankReading.findMany({ where: { reportId } });
  const have = new Set(existing.map((r) => r.tankKey));
  const missing = tanks.filter((t) => FUEL.includes(t.product) && !have.has(t.tankKey));

  if (missing.length) {
    await prisma.stockSaleTankReading.createMany({
      data: missing.map((t) => ({
        reportId,
        tankKey: t.tankKey,
        product: t.product,
        label: t.label,
        sortOrder: t.sortOrder,
        capacityLitres: t.capacityLitres,
        openingLitres: t.lastClosingLitres,
        closingLitres: null,
        salesLitres: null,
        ullageLitres: null,
      })),
      skipDuplicates: true,
    });
  }

  // Drop draft readings for tanks that were removed/deactivated in settings (not yet completed).
  const activeKeys = new Set(tanks.map((t) => t.tankKey));
  const stale = existing.filter((r) => !activeKeys.has(r.tankKey) && r.closingLitres == null);
  if (stale.length) {
    await prisma.stockSaleTankReading.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
  }

  // Refresh capacity/label/sort from settings for open readings still on active tanks.
  await writeOpenTankDetails(
    prisma,
    reportId,
    tanks
      .filter((tank): tank is typeof tank & { product: "PMS" | "AGO" } => tank.product === "PMS" || tank.product === "AGO")
      .map((tank) => ({
        tankKey: tank.tankKey,
        label: tank.label,
        sortOrder: tank.sortOrder,
        capacityLitres: tank.capacityLitres,
        product: tank.product,
      }))
  );

  return prisma.stockSaleTankReading.findMany({
    where: { reportId },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Tank keys that already have a submitted dip on another report for this station.
 * Those openings stay locked and come from the previous closing.
 */
export async function tankKeysWithCompletedPriorDip(stationId: string, reportId: string) {
  const rows = await prisma.stockSaleTankReading.findMany({
    where: {
      closingLitres: { not: null },
      report: {
        stationId,
        id: { not: reportId },
        tankDipsCompletedAt: { not: null },
      },
    },
    select: { tankKey: true },
    distinct: ["tankKey"],
  });
  return new Set(rows.map((row) => row.tankKey));
}

export type TankReadingInput = {
  tankKey: string;
  closingLitres: number | null;
  /** Accepted only when this tank has no submitted dip on an earlier report. */
  openingLitres?: number | null;
};

export type SaveTankDipsMode = "draft" | "complete";

export async function saveTankDipReadings(params: {
  dealerOrganizationId: string;
  reportId: string;
  expectedRevision: number;
  readings: TankReadingInput[];
  mode: SaveTankDipsMode;
}) {
  const report = await prisma.stockSaleReport.findUnique({
    where: { id: params.reportId },
    include: { tankReadings: true },
  });
  if (!report || report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "NOT_FOUND");
  }
  if (report.status === "CLOSED") {
    throw new StockReportingError("Closed reports cannot be edited.", "CLOSED");
  }
  if (!report.pumpMetersCompletedAt && params.mode === "complete") {
    throw new StockReportingError("Complete Pump Meter Readings before continuing.", "VALIDATION");
  }
  if (report.revision !== params.expectedRevision) {
    throw new StockReportingError(
      "This report was updated elsewhere. Refresh and try again.",
      "CONFLICT"
    );
  }

  const priorDips = await tankKeysWithCompletedPriorDip(report.stationId, report.id);
  const receiptByTank = await onReportReceiptLitres(report.stationId, report.reportingDate);
  const byKey = new Map(params.readings.map((r) => [r.tankKey, r]));
  const fieldErrors: Record<string, string> = {};
  const computed: {
    tankKey: string;
    openingLitres: number;
    closingLitres: number | null;
    salesLitres: number | null;
    ullageLitres: number | null;
    product: string;
  }[] = [];

  for (const row of report.tankReadings) {
    const input = byKey.get(row.tankKey);
    const needsInit = !priorDips.has(row.tankKey);
    const closing = input?.closingLitres ?? null;
    let openingBase = row.openingLitres;

    if (needsInit) {
      if (input?.openingLitres != null) openingBase = input.openingLitres;
      const openingRequired = params.mode === "complete" || closing != null;
      if (openingRequired && input?.openingLitres == null) {
        fieldErrors[`${row.tankKey}.opening`] = "Opening stock is required.";
        continue;
      }
      if (input?.openingLitres != null && input.openingLitres < 0) {
        fieldErrors[`${row.tankKey}.opening`] = "Opening stock must be nonnegative.";
        continue;
      }
    }

    const opening = addLitres(openingBase, receiptByTank.get(row.tankKey) ?? 0);

    if (params.mode === "complete") {
      if (closing == null) {
        fieldErrors[`${row.tankKey}.closing`] = "Closing stock is required.";
        continue;
      }
      const calc = calculateTankDip({
        capacity: row.capacityLitres,
        opening,
        closing,
      });
      if (!calc.ok) {
        const field = calc.error.startsWith("Opening") ? "opening" : "closing";
        fieldErrors[`${row.tankKey}.${field}`] = calc.error;
        continue;
      }
      computed.push({
        tankKey: row.tankKey,
        openingLitres: openingBase,
        closingLitres: closing,
        salesLitres: calc.sales,
        ullageLitres: calc.ullage,
        product: row.product,
      });
    } else if (closing != null) {
      const calc = calculateTankDip({
        capacity: row.capacityLitres,
        opening,
        closing,
      });
      if (!calc.ok) {
        const field = calc.error.startsWith("Opening") ? "opening" : "closing";
        fieldErrors[`${row.tankKey}.${field}`] = calc.error;
        continue;
      }
      computed.push({
        tankKey: row.tankKey,
        openingLitres: openingBase,
        closingLitres: closing,
        salesLitres: calc.sales,
        ullageLitres: calc.ullage,
        product: row.product,
      });
    } else {
      computed.push({
        tankKey: row.tankKey,
        openingLitres: openingBase,
        closingLitres: null,
        salesLitres: null,
        ullageLitres: null,
        product: row.product,
      });
    }
  }

  if (Object.keys(fieldErrors).length) {
    throw new StockReportingError(
      "Please fix the highlighted tank readings.",
      "VALIDATION",
      fieldErrors
    );
  }

  const totals = sumTankSalesByProduct(
    computed.map((c) => ({ product: c.product, sales: c.salesLitres }))
  );

  return prisma.$transaction(async (tx) => {
    const written = await writeTankDipRows(tx, report.id, computed);
    if (written !== computed.length) {
      throw new StockReportingError(
        "Could not save every tank dip reading. Refresh and try again.",
        "CONFLICT"
      );
    }

    const data: Record<string, unknown> = {
      revision: { increment: 1 },
      tankSalesPmsLitres: totals.pms,
      tankSalesAgoLitres: totals.ago,
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
    };

    if (params.mode === "complete") {
      data.tankDipsCompletedAt = new Date();
      const closings = computed.flatMap((row) =>
        row.closingLitres == null ? [] : [{ tankKey: row.tankKey, closingLitres: row.closingLitres }]
      );
      const stamped = await writeTankClosingRows(tx, report.stationId, closings);
      if (stamped !== closings.length) {
        throw new StockReportingError(
          "Could not save every tank dip reading. Refresh and try again.",
          "CONFLICT"
        );
      }
    }

    return tx.stockSaleReport.update({
      where: { id: report.id },
      data,
      include: { tankReadings: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

export type TankReadingRowDto = {
  id: string;
  tankKey: string;
  product: "PMS" | "AGO";
  label: string;
  capacityLitres: number;
  openingLitres: number;
  closingLitres: number | null;
  salesLitres: number | null;
  ullageLitres: number | null;
  /** True only until this tank has a submitted dip on an earlier report. */
  needsOpeningInit: boolean;
  /** Fuel receipted today that is added on top of the start-of-day opening. */
  receiptLitres: number;
};

export function toTankReadingDto(
  row: StockSaleTankReading,
  needsOpeningInit = false,
  receiptLitres = 0
): TankReadingRowDto {
  return {
    id: row.id,
    tankKey: row.tankKey,
    product: row.product === "AGO" ? "AGO" : "PMS",
    label: row.label,
    capacityLitres: row.capacityLitres,
    openingLitres: row.openingLitres,
    closingLitres: row.closingLitres,
    salesLitres: row.salesLitres,
    ullageLitres: row.ullageLitres,
    needsOpeningInit,
    receiptLitres,
  };
}

export async function toTankReadingDtos(
  rows: StockSaleTankReading[],
  stationId: string,
  reportId: string,
  reportingDate: Date
): Promise<TankReadingRowDto[]> {
  const [priorDips, receipts] = await Promise.all([
    tankKeysWithCompletedPriorDip(stationId, reportId),
    onReportReceiptLitres(stationId, reportingDate),
  ]);
  return rows.map((row) =>
    toTankReadingDto(row, !priorDips.has(row.tankKey), receipts.get(row.tankKey) ?? 0)
  );
}
