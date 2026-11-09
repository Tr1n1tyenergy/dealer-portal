import type { ProductCode, StockSaleTankReading } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultTankDefinitions } from "./equipment";
import { calculateTankDip, sumTankSalesByProduct } from "./tank-calc";
import { StockReportingError } from "./service";

const FUEL: ProductCode[] = ["PMS", "AGO"];

export async function ensureStationTanks(stationId: string) {
  const defs = defaultTankDefinitions();
  const existing = await prisma.stationTank.findMany({ where: { stationId } });
  const byKey = new Map(existing.map((t) => [t.tankKey, t]));

  for (const d of defs) {
    const row = byKey.get(d.tankKey);
    if (!row) {
      try {
        await prisma.stationTank.create({
          data: {
            stationId,
            tankKey: d.tankKey,
            product: d.product,
            label: d.label,
            sortOrder: d.sortOrder,
            capacityLitres: d.capacityLitres,
            lastClosingLitres: 0,
            active: true,
          },
        });
      } catch (err) {
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
      await prisma.stationTank.update({
        where: { id: row.id },
        data: {
          active: true,
          product: d.product,
          label: d.label,
          sortOrder: d.sortOrder,
          capacityLitres: d.capacityLitres,
        },
      });
    }
  }

  return prisma.stationTank.findMany({
    where: { stationId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function ensureTankReadingsForReport(reportId: string, stationId: string) {
  const tanks = await ensureStationTanks(stationId);
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

  return prisma.stockSaleTankReading.findMany({
    where: { reportId },
    orderBy: { sortOrder: "asc" },
  });
}

export type TankReadingInput = {
  tankKey: string;
  closingLitres: number | null;
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

  const byKey = new Map(params.readings.map((r) => [r.tankKey, r]));
  const fieldErrors: Record<string, string> = {};
  const computed: {
    tankKey: string;
    closingLitres: number | null;
    salesLitres: number | null;
    ullageLitres: number | null;
    product: string;
  }[] = [];

  for (const row of report.tankReadings) {
    const input = byKey.get(row.tankKey);
    const closing = input?.closingLitres ?? null;

    if (params.mode === "complete") {
      if (closing == null) {
        fieldErrors[`${row.tankKey}.closing`] = "Closing stock is required.";
        continue;
      }
      const calc = calculateTankDip({
        capacity: row.capacityLitres,
        opening: row.openingLitres,
        closing,
      });
      if (!calc.ok) {
        fieldErrors[`${row.tankKey}.closing`] = calc.error;
        continue;
      }
      computed.push({
        tankKey: row.tankKey,
        closingLitres: closing,
        salesLitres: calc.sales,
        ullageLitres: calc.ullage,
        product: row.product,
      });
    } else if (closing != null) {
      const calc = calculateTankDip({
        capacity: row.capacityLitres,
        opening: row.openingLitres,
        closing,
      });
      if (!calc.ok) {
        fieldErrors[`${row.tankKey}.closing`] = calc.error;
        continue;
      }
      computed.push({
        tankKey: row.tankKey,
        closingLitres: closing,
        salesLitres: calc.sales,
        ullageLitres: calc.ullage,
        product: row.product,
      });
    } else {
      computed.push({
        tankKey: row.tankKey,
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
    for (const row of computed) {
      await tx.stockSaleTankReading.update({
        where: {
          reportId_tankKey: { reportId: report.id, tankKey: row.tankKey },
        },
        data: {
          closingLitres: row.closingLitres,
          salesLitres: row.salesLitres,
          ullageLitres: row.ullageLitres,
        },
      });
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
      for (const row of computed) {
        if (row.closingLitres == null) continue;
        await tx.stationTank.updateMany({
          where: { stationId: report.stationId, tankKey: row.tankKey },
          data: { lastClosingLitres: row.closingLitres },
        });
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
};

export function toTankReadingDto(row: StockSaleTankReading): TankReadingRowDto {
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
  };
}
