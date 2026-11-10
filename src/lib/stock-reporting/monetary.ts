import { Prisma, type MonetaryState } from "@prisma/client";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { prisma } from "@/lib/prisma";
import {
  closeShiftBlock,
  computeMonetarySummary,
  parseKesInput,
  type MonetarySummary,
} from "./monetary-calc";
import { buildStockReportReference } from "./reference";
import { StockReportingError } from "./service";

export type SaveMonetaryMode = "draft" | "close";

export type SellingPriceSnapshot = {
  pms: number | null;
  ago: number | null;
  source: "epra_temp_pump_max" | "report_snapshot" | "missing";
  note: string;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve pump selling prices for expected sales.
 * Uses snapshotted report prices when present; otherwise EPRA max pump prices for the
 * station loading region (temporary until station pump pricelists exist).
 * Limitation: a single period price is applied to the full day's meter volume —
 * intra-day price changes are not allocated.
 */
export function resolveSellingPrices(params: {
  stationCode: string | null | undefined;
  snapshotPms?: Prisma.Decimal | number | null;
  snapshotAgo?: Prisma.Decimal | number | null;
}): SellingPriceSnapshot {
  const snapPms = decimalToNumber(params.snapshotPms ?? null);
  const snapAgo = decimalToNumber(params.snapshotAgo ?? null);
  if (snapPms != null && snapAgo != null) {
    return {
      pms: snapPms,
      ago: snapAgo,
      source: "report_snapshot",
      note: "Using selling prices snapshotted on this report.",
    };
  }

  const code = params.stationCode?.trim() || null;
  if (!code) {
    return {
      pms: null,
      ago: null,
      source: "missing",
      note: "Station has no fulfillment code; pump selling prices are unavailable.",
    };
  }

  const pms = epraUnitPriceForStation(code, "PMS");
  const ago = epraUnitPriceForStation(code, "AGO");
  if (pms == null || ago == null) {
    return {
      pms: null,
      ago: null,
      source: "missing",
      note: "No EPRA/pump selling price is configured for this station. Final submission is blocked until prices are available.",
    };
  }

  return {
    pms,
    ago,
    source: "epra_temp_pump_max",
    note: "Temporary EPRA maximum pump prices for the station loading region. Station-specific pump pricelists and intra-day price changes are not yet wired.",
  };
}

export function buildMonetarySummaryForReport(params: {
  meterPms: number;
  meterAgo: number;
  pricePms: number | null;
  priceAgo: number | null;
  cashKes: number | null;
  mpesaKes: number | null;
  cardKes: number | null;
}): MonetarySummary {
  return computeMonetarySummary(params);
}

function monetaryStateFromSummary(summary: MonetarySummary): MonetaryState {
  if (summary.state === "BALANCED") return "BALANCED";
  if (summary.state === "SHORTAGE") return "SHORTAGE";
  if (summary.state === "OVERAGE") return "OVERAGE";
  return "INCOMPLETE";
}

export async function saveMonetaryReconciliation(params: {
  dealerOrganizationId: string;
  reportId: string;
  expectedRevision: number;
  userId: string;
  stationCode: string | null;
  cashRaw: string | null;
  mpesaRaw: string | null;
  cardRaw: string | null;
  discrepancyReason?: string | null;
  mode: SaveMonetaryMode;
  confirmClose?: boolean;
  equipmentSnapshot?: {
    pumpCount: number;
    tankCount: number;
    pumpsPms: number;
    pumpsAgo: number;
    tanksPms: number;
    tanksAgo: number;
  };
}) {
  const report = await prisma.stockSaleReport.findUnique({ where: { id: params.reportId } });
  if (!report || report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "NOT_FOUND");
  }
  if (report.status === "CLOSED") {
    throw new StockReportingError("This report is already closed.", "CLOSED");
  }
  if (!report.pumpMetersCompletedAt || !report.tankDipsCompletedAt || !report.wetStockCompletedAt) {
    throw new StockReportingError(
      "Complete Pump Meters, Tank Dips, and Wet Stock Reconciliation before monetary closure.",
      "VALIDATION"
    );
  }
  if (report.revision !== params.expectedRevision) {
    throw new StockReportingError(
      "This report was updated elsewhere. Refresh and try again.",
      "CONFLICT"
    );
  }

  const cashKes = parseKesInput(params.cashRaw);
  const mpesaKes = parseKesInput(params.mpesaRaw);
  const cardKes = parseKesInput(params.cardRaw);

  const fieldErrors: Record<string, string> = {};
  if (params.cashRaw != null && String(params.cashRaw).trim() !== "" && cashKes == null) {
    fieldErrors.cash = "Enter a valid non-negative Cash amount.";
  }
  if (params.mpesaRaw != null && String(params.mpesaRaw).trim() !== "" && mpesaKes == null) {
    fieldErrors.mpesa = "Enter a valid non-negative M-Pesa amount.";
  }
  if (params.cardRaw != null && String(params.cardRaw).trim() !== "" && cardKes == null) {
    fieldErrors.card = "Enter a valid non-negative Visa/Card amount.";
  }
  if (Object.keys(fieldErrors).length) {
    throw new StockReportingError("Fix the collection amounts highlighted below.", "VALIDATION", fieldErrors);
  }

  const prices = resolveSellingPrices({
    stationCode: params.stationCode,
    snapshotPms: report.sellingPricePmsKes,
    snapshotAgo: report.sellingPriceAgoKes,
  });

  const summary = computeMonetarySummary({
    meterPms: report.meterSalesPmsLitres ?? 0,
    meterAgo: report.meterSalesAgoLitres ?? 0,
    pricePms: prices.pms,
    priceAgo: prices.ago,
    cashKes,
    mpesaKes,
    cardKes,
  });

  const discrepancyReason = params.discrepancyReason?.trim() || null;
  const wetOk =
    report.wetState === "BALANCED" ||
    report.wetState === "VARIANCE_RECORDED" ||
    report.wetState === "RECONCILED" ||
    report.wetState === "PENDING_APPROVAL";

  if (params.mode === "close") {
    if (!params.confirmClose) {
      throw new StockReportingError("Confirm close before submitting the daily report.", "VALIDATION");
    }
    if (!wetOk) {
      throw new StockReportingError(
        "Wet stock reconciliation must be completed before closing the shift.",
        "VALIDATION"
      );
    }
    if (!summary.pricesComplete) {
      throw new StockReportingError(
        prices.note || "Selling prices are missing. Final submission is blocked until prices are available.",
        "VALIDATION"
      );
    }
    if (!summary.collectionsComplete) {
      throw new StockReportingError(
        "Enter Cash, M-Pesa, and Visa/Card collections before closing the shift. Blank fields are not treated as zero.",
        "VALIDATION",
        {
          ...(cashKes == null ? { cash: "Required." } : {}),
          ...(mpesaKes == null ? { mpesa: "Required." } : {}),
          ...(cardKes == null ? { card: "Required." } : {}),
        }
      );
    }
    const block = closeShiftBlock(summary, discrepancyReason);
    if (block) {
      throw new StockReportingError(block, "VALIDATION", { discrepancyReason: block });
    }
  }

  const monetaryState = monetaryStateFromSummary(summary);
  const action = params.mode === "close" ? "monetary_close" : "monetary_draft";
  const reportReference =
    params.mode === "close"
      ? report.reportReference ??
        buildStockReportReference({
          stationCode: params.stationCode,
          reportingDate: report.reportingDate,
        })
      : report.reportReference;
  const equipment = params.equipmentSnapshot;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.stockSaleReport.update({
      where: { id: report.id },
      data: {
        revision: { increment: 1 },
        sellingPricePmsKes: prices.pms != null ? new Prisma.Decimal(prices.pms.toFixed(4)) : null,
        sellingPriceAgoKes: prices.ago != null ? new Prisma.Decimal(prices.ago.toFixed(4)) : null,
        expectedPmsKes:
          summary.expectedPmsKes != null ? new Prisma.Decimal(summary.expectedPmsKes.toFixed(2)) : null,
        expectedAgoKes:
          summary.expectedAgoKes != null ? new Prisma.Decimal(summary.expectedAgoKes.toFixed(2)) : null,
        expectedRevenueKes:
          summary.expectedTotalKes != null
            ? new Prisma.Decimal(summary.expectedTotalKes.toFixed(2))
            : null,
        cashCollectionsKes: cashKes != null ? new Prisma.Decimal(cashKes.toFixed(2)) : null,
        mpesaCollectionsKes: mpesaKes != null ? new Prisma.Decimal(mpesaKes.toFixed(2)) : null,
        cardCollectionsKes: cardKes != null ? new Prisma.Decimal(cardKes.toFixed(2)) : null,
        collectionsKes:
          summary.collectionsTotalKes != null
            ? new Prisma.Decimal(summary.collectionsTotalKes.toFixed(2))
            : null,
        monetaryDifferenceKes:
          summary.differenceKes != null
            ? new Prisma.Decimal(summary.differenceKes.toFixed(2))
            : null,
        monetaryState,
        monetaryDiscrepancyReason: discrepancyReason,
        monetaryCompletedAt: params.mode === "close" ? new Date() : report.monetaryCompletedAt,
        status: params.mode === "close" ? "CLOSED" : "DRAFT",
        closedAt: params.mode === "close" ? new Date() : report.closedAt,
        closedById: params.mode === "close" ? params.userId : report.closedById,
        reportReference: params.mode === "close" ? reportReference : report.reportReference,
        ...(params.mode === "close" && equipment
          ? {
              submittedPumpCount: equipment.pumpCount,
              submittedTankCount: equipment.tankCount,
              submittedPumpsPms: equipment.pumpsPms,
              submittedPumpsAgo: equipment.pumpsAgo,
              submittedTanksPms: equipment.tanksPms,
              submittedTanksAgo: equipment.tanksAgo,
            }
          : {}),
      },
    });

    await tx.stockSaleMonetaryAudit.create({
      data: {
        reportId: report.id,
        actorId: params.userId,
        action,
        details: JSON.stringify({
          summary,
          prices,
          discrepancyReason,
          wetState: report.wetState,
          wetResolution: report.wetResolution,
          reportReference,
        }),
      },
    });

    return updated;
  });
}
