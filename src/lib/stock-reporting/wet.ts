import type { WetStockResolution, WetStockState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeWetVariances } from "./wet-calc";
import { StockReportingError } from "./service";

export type WetResolutionChoice = "MATCH_DELIVERY" | "REVIEW_READINGS" | "RECORD_LOSS" | "BALANCED";

export type SaveWetMode = "draft" | "complete";

export async function listEligibleStockDeliveries(_params: {
  stationId: string;
  reportingDate: Date;
}) {
  /** No wet-stock receipt ledger exists yet — never invent deliveries. */
  return [] as {
    id: string;
    reference: string;
    product: "PMS" | "AGO";
    quantityLitres: number;
  }[];
}

export async function saveWetStockReconciliation(params: {
  dealerOrganizationId: string;
  reportId: string;
  expectedRevision: number;
  userId: string;
  resolution: WetResolutionChoice | "NONE";
  lossReason?: string | null;
  mode: SaveWetMode;
}) {
  const report = await prisma.stockSaleReport.findUnique({ where: { id: params.reportId } });
  if (!report || report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "NOT_FOUND");
  }
  if (report.status === "CLOSED") {
    throw new StockReportingError("Closed reports cannot be edited.", "CLOSED");
  }
  if (!report.pumpMetersCompletedAt || !report.tankDipsCompletedAt) {
    throw new StockReportingError(
      "Complete Pump Meter and Tank Dip readings before reconciliation.",
      "VALIDATION"
    );
  }
  if (report.revision !== params.expectedRevision) {
    throw new StockReportingError(
      "This report was updated elsewhere. Refresh and try again.",
      "CONFLICT"
    );
  }

  const summary = computeWetVariances({
    meterPms: report.meterSalesPmsLitres ?? 0,
    meterAgo: report.meterSalesAgoLitres ?? 0,
    tankPms: report.tankSalesPmsLitres ?? 0,
    tankAgo: report.tankSalesAgoLitres ?? 0,
  });

  let resolution: WetStockResolution = params.resolution === "NONE" ? "NONE" : params.resolution;
  let wetState: WetStockState = summary.balanced ? "BALANCED" : "VARIANCE_DETECTED";
  let lossReason = params.lossReason?.trim() || null;
  let lossAt: Date | null = null;
  let lossBy: string | null = null;

  if (params.mode === "complete") {
    if (summary.balanced) {
      resolution = "BALANCED";
      wetState = "BALANCED";
      lossReason = null;
    } else if (resolution === "MATCH_DELIVERY") {
      const deliveries = await listEligibleStockDeliveries({
        stationId: report.stationId,
        reportingDate: report.reportingDate,
      });
      if (!deliveries.length) {
        throw new StockReportingError(
          "No eligible stock deliveries were found for this reporting period. Choose another option or correct readings.",
          "VALIDATION"
        );
      }
      wetState = "DELIVERY_MATCHING";
      throw new StockReportingError(
        "Delivery matching requires a verified receipt allocation before continuing.",
        "VALIDATION"
      );
    } else if (resolution === "REVIEW_READINGS") {
      throw new StockReportingError(
        "Review & correct readings from Step 1 or Step 2, then return here to continue.",
        "VALIDATION"
      );
    } else if (resolution === "RECORD_LOSS") {
      if (!lossReason || lossReason.length < 8) {
        throw new StockReportingError(
          "Provide a clear loss explanation (at least 8 characters) before continuing.",
          "VALIDATION",
          { lossReason: "Reason is required." }
        );
      }
      wetState = "VARIANCE_RECORDED";
      lossAt = new Date();
      lossBy = params.userId;
    } else {
      throw new StockReportingError(
        "Select how you would like to reconcile the variance before continuing.",
        "VALIDATION"
      );
    }
  } else if (resolution === "MATCH_DELIVERY") {
    wetState = "DELIVERY_MATCHING";
  } else if (resolution === "REVIEW_READINGS") {
    wetState = "READINGS_UNDER_REVIEW";
  } else if (resolution === "RECORD_LOSS") {
    wetState = summary.balanced ? "BALANCED" : "VARIANCE_DETECTED";
  } else if (summary.balanced) {
    resolution = "BALANCED";
    wetState = "BALANCED";
  }

  const action =
    params.mode === "complete" ? "wet_complete" : "wet_draft";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.stockSaleReport.update({
      where: { id: report.id },
      data: {
        revision: { increment: 1 },
        wetResolution: resolution,
        wetState,
        wetVariancePmsLitres: summary.variancePms,
        wetVarianceAgoLitres: summary.varianceAgo,
        wetVarianceTotalLitres: summary.varianceTotal,
        wetAbsoluteVarianceLitres: summary.absoluteVariance,
        wetLossReason: resolution === "RECORD_LOSS" ? lossReason : null,
        wetLossAcknowledgedAt: resolution === "RECORD_LOSS" ? lossAt : null,
        wetLossAcknowledgedById: resolution === "RECORD_LOSS" ? lossBy : null,
        wetStockCompletedAt: params.mode === "complete" ? new Date() : report.wetStockCompletedAt,
      },
    });

    await tx.stockSaleWetAudit.create({
      data: {
        reportId: report.id,
        actorId: params.userId,
        action,
        details: JSON.stringify({
          resolution,
          wetState,
          summary,
          lossReason: resolution === "RECORD_LOSS" ? lossReason : null,
        }),
      },
    });

    return updated;
  });
}
