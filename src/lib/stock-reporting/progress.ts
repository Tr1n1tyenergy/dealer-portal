import type { StockSaleReport, StockSaleReportStatus } from "@prisma/client";
import {
  STOCK_REPORT_STAGE_META,
  STOCK_REPORT_STAGES,
  type StockReportStageId,
} from "./constants";

export type StageUiState = "done" | "current" | "pending";

export type DashboardReportStatus = "not_started" | "in_progress" | "closed";

export type StageProgressRow = {
  id: StockReportStageId;
  label: string;
  href: string;
  state: StageUiState;
  statusLabel: string;
  stepNumber: number;
};

type ReportProgressFields = Pick<
  StockSaleReport,
  | "status"
  | "pumpMetersCompletedAt"
  | "tankDipsCompletedAt"
  | "wetStockCompletedAt"
  | "monetaryCompletedAt"
>;

function stageCompletedAt(report: ReportProgressFields, stage: StockReportStageId): Date | null {
  if (stage === "PUMP_METERS") return report.pumpMetersCompletedAt;
  if (stage === "TANK_DIPS") return report.tankDipsCompletedAt;
  if (stage === "WET_STOCK") return report.wetStockCompletedAt;
  return report.monetaryCompletedAt;
}

export function isStageCompleted(report: ReportProgressFields, stage: StockReportStageId): boolean {
  if (report.status === "CLOSED") return true;
  return Boolean(stageCompletedAt(report, stage));
}

export function nextIncompleteStage(report: ReportProgressFields | null): StockReportStageId {
  if (!report || report.status === "CLOSED") return "PUMP_METERS";
  for (const stage of STOCK_REPORT_STAGES) {
    if (!isStageCompleted(report, stage)) return stage;
  }
  return "MONETARY";
}

export function dashboardReportStatus(
  report: { status: StockSaleReportStatus } | null
): DashboardReportStatus {
  if (!report) return "not_started";
  if (report.status === "CLOSED") return "closed";
  return "in_progress";
}

export function buildStageProgress(report: ReportProgressFields | null): StageProgressRow[] {
  const closed = report?.status === "CLOSED";
  const current = closed ? null : nextIncompleteStage(report);

  return STOCK_REPORT_STAGES.map((id, index) => {
    const meta = STOCK_REPORT_STAGE_META[id];
    let state: StageUiState = "pending";
    if (closed || (report && isStageCompleted(report, id))) {
      state = "done";
    } else if (id === current) {
      state = "current";
    }
    return {
      id,
      label: meta.label,
      href: meta.href,
      state,
      statusLabel: meta.shortStatus[state === "done" ? "done" : state === "current" ? "current" : "pending"],
      stepNumber: index + 1,
    };
  });
}
