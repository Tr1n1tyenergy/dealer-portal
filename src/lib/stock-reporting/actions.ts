"use server";

import { revalidatePath } from "next/cache";
import { requireDealer } from "@/lib/session";
import { STOCK_REPORT_STAGE_META, type StockReportStageId } from "./constants";
import { nextIncompleteStage } from "./progress";
import {
  type PumpReadingInput,
  type SavePumpMetersMode,
  savePumpMeterReadings,
} from "./pumps";
import {
  type SaveTankDipsMode,
  type TankReadingInput,
  saveTankDipReadings,
} from "./tanks";
import {
  type SaveWetMode,
  type WetResolutionChoice,
  saveWetStockReconciliation,
} from "./wet";
import {
  type SaveMonetaryMode,
  saveMonetaryReconciliation,
} from "./monetary";
import { resolveStationEquipment } from "./equipment";
import { resetDraftReport, startTodaysReport, StockReportingError } from "./service";
import { prisma } from "@/lib/prisma";

export type StockReportActionResult =
  | { ok: true; redirectTo: string; revision?: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function stageHref(stage: StockReportStageId) {
  return STOCK_REPORT_STAGE_META[stage].href;
}

export async function startTodaysStockReportAction(stationId: string): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await startTodaysReport({
      dealerOrganizationId: orgId,
      stationId,
      userId: session.user.id,
    });
    revalidatePath("/dealer/stock-reporting");
    return { ok: true, redirectTo: stageHref(nextIncompleteStage(report)) };
  } catch (err) {
    if (err instanceof StockReportingError) return { ok: false, error: err.message };
    console.error("[stock-reporting] startTodaysStockReportAction", err);
    return { ok: false, error: "Could not start today's report. Please try again." };
  }
}

export async function continueStockReportAction(stationId: string): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await startTodaysReport({
      dealerOrganizationId: orgId,
      stationId,
      userId: session.user.id,
    });
    if (report.status === "CLOSED") {
      return { ok: true, redirectTo: `/dealer/stock-reporting/report/${report.id}` };
    }
    revalidatePath("/dealer/stock-reporting");
    return { ok: true, redirectTo: stageHref(nextIncompleteStage(report)) };
  } catch (err) {
    if (err instanceof StockReportingError) return { ok: false, error: err.message };
    console.error("[stock-reporting] continueStockReportAction", err);
    return { ok: false, error: "Could not continue the report. Please try again." };
  }
}

export async function resetTodaysStockReportAction(params: {
  reportId: string;
  expectedRevision: number;
}): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await resetDraftReport({
      dealerOrganizationId: orgId,
      reportId: params.reportId,
      expectedRevision: params.expectedRevision,
    });
    revalidatePath("/dealer/stock-reporting");
    return { ok: true, redirectTo: stageHref(nextIncompleteStage(report)) };
  } catch (err) {
    if (err instanceof StockReportingError) return { ok: false, error: err.message };
    console.error("[stock-reporting] resetTodaysStockReportAction", err);
    return { ok: false, error: "Could not reset the report. Please try again." };
  }
}

export async function savePumpMetersAction(params: {
  reportId: string;
  expectedRevision: number;
  readings: PumpReadingInput[];
  mode: SavePumpMetersMode;
  exitToDashboard?: boolean;
}): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await savePumpMeterReadings({
      dealerOrganizationId: orgId,
      reportId: params.reportId,
      expectedRevision: params.expectedRevision,
      readings: params.readings,
      mode: params.mode,
    });
    revalidatePath("/dealer/stock-reporting");
    revalidatePath("/dealer/stock-reporting/pump-meters");
    revalidatePath("/dealer/stock-reporting/tank-dips");

    if (params.exitToDashboard) {
      return { ok: true, redirectTo: "/dealer/stock-reporting", revision: report.revision };
    }
    if (params.mode === "complete") {
      return {
        ok: true,
        redirectTo: STOCK_REPORT_STAGE_META.TANK_DIPS.href,
        revision: report.revision,
      };
    }
    return { ok: true, redirectTo: STOCK_REPORT_STAGE_META.PUMP_METERS.href, revision: report.revision };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] savePumpMetersAction", err);
    return { ok: false, error: "Could not save pump meter readings. Please try again." };
  }
}

export async function saveTankDipsAction(params: {
  reportId: string;
  expectedRevision: number;
  readings: TankReadingInput[];
  mode: SaveTankDipsMode;
  exitToDashboard?: boolean;
}): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await saveTankDipReadings({
      dealerOrganizationId: orgId,
      reportId: params.reportId,
      expectedRevision: params.expectedRevision,
      readings: params.readings,
      mode: params.mode,
    });
    revalidatePath("/dealer/stock-reporting");
    revalidatePath("/dealer/stock-reporting/tank-dips");
    revalidatePath("/dealer/stock-reporting/wet-stock");

    if (params.exitToDashboard) {
      return { ok: true, redirectTo: "/dealer/stock-reporting", revision: report.revision };
    }
    if (params.mode === "complete") {
      return {
        ok: true,
        redirectTo: STOCK_REPORT_STAGE_META.WET_STOCK.href,
        revision: report.revision,
      };
    }
    return { ok: true, redirectTo: STOCK_REPORT_STAGE_META.TANK_DIPS.href, revision: report.revision };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] saveTankDipsAction", err);
    return { ok: false, error: "Could not save tank dip readings. Please try again." };
  }
}

export async function saveWetStockAction(params: {
  reportId: string;
  expectedRevision: number;
  resolution: WetResolutionChoice | "NONE";
  lossReason?: string | null;
  mode: SaveWetMode;
  exitToDashboard?: boolean;
}): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const report = await saveWetStockReconciliation({
      dealerOrganizationId: orgId,
      reportId: params.reportId,
      expectedRevision: params.expectedRevision,
      userId: session.user.id,
      resolution: params.resolution,
      lossReason: params.lossReason,
      mode: params.mode,
    });
    revalidatePath("/dealer/stock-reporting");
    revalidatePath("/dealer/stock-reporting/wet-stock");
    revalidatePath("/dealer/stock-reporting/monetary");

    if (params.exitToDashboard) {
      return { ok: true, redirectTo: "/dealer/stock-reporting", revision: report.revision };
    }
    if (params.mode === "complete") {
      return {
        ok: true,
        redirectTo: STOCK_REPORT_STAGE_META.MONETARY.href,
        revision: report.revision,
      };
    }
    return { ok: true, redirectTo: STOCK_REPORT_STAGE_META.WET_STOCK.href, revision: report.revision };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] saveWetStockAction", err);
    return { ok: false, error: "Could not save wet stock reconciliation. Please try again." };
  }
}

export async function saveMonetaryAction(params: {
  reportId: string;
  expectedRevision: number;
  cashRaw: string | null;
  mpesaRaw: string | null;
  cardRaw: string | null;
  discrepancyReason?: string | null;
  mode: SaveMonetaryMode;
  confirmClose?: boolean;
  exitToDashboard?: boolean;
}): Promise<StockReportActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const reportMeta = await prisma.stockSaleReport.findUnique({
      where: { id: params.reportId },
      select: {
        dealerOrganizationId: true,
        station: {
          select: {
            code: true,
            pumpCount: true,
            tankCount: true,
            products: true,
          },
        },
      },
    });
    if (!reportMeta || reportMeta.dealerOrganizationId !== orgId) {
      return { ok: false, error: "Report not found." };
    }

    const equipment = resolveStationEquipment(reportMeta.station);
    const report = await saveMonetaryReconciliation({
      dealerOrganizationId: orgId,
      reportId: params.reportId,
      expectedRevision: params.expectedRevision,
      userId: session.user.id,
      stationCode: reportMeta.station.code,
      cashRaw: params.cashRaw,
      mpesaRaw: params.mpesaRaw,
      cardRaw: params.cardRaw,
      discrepancyReason: params.discrepancyReason,
      mode: params.mode,
      confirmClose: params.confirmClose,
      equipmentSnapshot: {
        pumpCount: equipment.pumpCount,
        tankCount: equipment.tankCount,
        pumpsPms: equipment.pumpsByProduct.PMS,
        pumpsAgo: equipment.pumpsByProduct.AGO,
        tanksPms: equipment.tanksByProduct.PMS,
        tanksAgo: equipment.tanksByProduct.AGO,
      },
    });

    revalidatePath("/dealer/stock-reporting");
    revalidatePath("/dealer/stock-reporting/records");
    revalidatePath("/dealer/stock-reporting/history");
    revalidatePath("/dealer/stock-reporting/monetary");
    revalidatePath(`/dealer/stock-reporting/report/${report.id}`);
    revalidatePath(`/dealer/stock-reporting/report/${report.id}/submitted`);

    if (params.mode === "close") {
      return {
        ok: true,
        redirectTo: `/dealer/stock-reporting/report/${report.id}/submitted`,
        revision: report.revision,
      };
    }
    if (params.exitToDashboard) {
      return { ok: true, redirectTo: "/dealer/stock-reporting", revision: report.revision };
    }
    return {
      ok: true,
      redirectTo: STOCK_REPORT_STAGE_META.MONETARY.href,
      revision: report.revision,
    };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] saveMonetaryAction", err);
    return { ok: false, error: "Could not save monetary reconciliation. Please try again." };
  }
}

export type RttActionResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createRttEventAction(formData: FormData): Promise<RttActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const stationId = String(formData.get("stationId") ?? "");
    const pumpId = String(formData.get("pumpId") ?? "");
    const volumeRaw = String(formData.get("volumeRaw") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const submissionKey = String(formData.get("submissionKey") ?? "");
    const jobCardFile = formData.get("jobCard");

    let jobCardUpload = null;
    if (jobCardFile instanceof File && jobCardFile.size > 0) {
      const { validateRttJobCard } = await import("./rtt-storage");
      try {
        jobCardUpload = await validateRttJobCard(jobCardFile);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Invalid job card file.",
          fieldErrors: {
            jobCard: err instanceof Error ? err.message : "Invalid job card file.",
          },
        };
      }
    }

    const { createRttEvent } = await import("./rtt");
    const event = await createRttEvent({
      dealerOrganizationId: orgId,
      stationId,
      userId: session.user.id,
      pumpId,
      volumeRaw,
      reason,
      submissionKey,
      jobCardUpload,
    });
    revalidatePath("/dealer/stock-reporting/rtt");
    revalidatePath("/dealer/stock-reporting/pump-meters");
    revalidatePath("/dealer/stock-reporting");
    return { ok: true, eventId: event.id };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] createRttEventAction", err);
    return { ok: false, error: "Could not save RTT entry. Please try again." };
  }
}

export async function correctRttEventAction(params: {
  eventId: string;
  volumeRaw: string;
  reason: string;
}): Promise<RttActionResult> {
  try {
    const session = await requireDealer();
    const orgId = session.user.dealerOrganizationId!;
    const { correctRttEvent } = await import("./rtt");
    const event = await correctRttEvent({
      dealerOrganizationId: orgId,
      eventId: params.eventId,
      userId: session.user.id,
      volumeRaw: params.volumeRaw,
      reason: params.reason,
    });
    revalidatePath("/dealer/stock-reporting/rtt");
    revalidatePath("/dealer/stock-reporting/pump-meters");
    revalidatePath("/dealer/stock-reporting");
    return { ok: true, eventId: event.id };
  } catch (err) {
    if (err instanceof StockReportingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[stock-reporting] correctRttEventAction", err);
    return { ok: false, error: "Could not correct RTT entry. Please try again." };
  }
}
