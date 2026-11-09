import type { StockSaleReportStage } from "@prisma/client";

export const STOCK_REPORT_STAGES = [
  "PUMP_METERS",
  "TANK_DIPS",
  "WET_STOCK",
  "MONETARY",
] as const satisfies readonly StockSaleReportStage[];

export type StockReportStageId = (typeof STOCK_REPORT_STAGES)[number];

export const STOCK_REPORT_STAGE_META: Record<
  StockReportStageId,
  { label: string; href: string; shortStatus: { done: string; current: string; pending: string } }
> = {
  PUMP_METERS: {
    label: "Pump Meters",
    href: "/dealer/stock-reporting/pump-meters",
    shortStatus: { done: "Completed", current: "In Progress", pending: "Pending" },
  },
  TANK_DIPS: {
    label: "Tank Dips",
    href: "/dealer/stock-reporting/tank-dips",
    shortStatus: { done: "Completed", current: "In Progress", pending: "Pending" },
  },
  WET_STOCK: {
    label: "Wet Stock",
    href: "/dealer/stock-reporting/wet-stock",
    shortStatus: { done: "Completed", current: "In Progress", pending: "Pending" },
  },
  MONETARY: {
    label: "Monetary",
    href: "/dealer/stock-reporting/monetary",
    shortStatus: { done: "Completed", current: "In Progress", pending: "Pending" },
  },
};

export const STOCK_REPORTING_MODULE_NAV = [
  {
    key: "reporting" as const,
    label: "Stock Reporting",
    href: "/dealer/stock-reporting",
  },
  {
    key: "records" as const,
    label: "Report Records",
    href: "/dealer/stock-reporting/records",
  },
  {
    key: "rtt" as const,
    label: "RTT & Truck Calibration",
    href: "/dealer/stock-reporting/rtt",
  },
] as const;

export type StockReportingModuleKey = (typeof STOCK_REPORTING_MODULE_NAV)[number]["key"];

/** Full labels for the daily-report wizard sidebar (mockup). */
export const STOCK_REPORT_WIZARD_STAGES = [
  {
    id: "PUMP_METERS" as const,
    step: 1,
    label: "Pump Meter Readings",
    href: "/dealer/stock-reporting/pump-meters",
  },
  {
    id: "TANK_DIPS" as const,
    step: 2,
    label: "Tank Dip Readings",
    href: "/dealer/stock-reporting/tank-dips",
  },
  {
    id: "WET_STOCK" as const,
    step: 3,
    label: "Wet Stock Reconciliation",
    href: "/dealer/stock-reporting/wet-stock",
  },
  {
    id: "MONETARY" as const,
    step: 4,
    label: "Monetary Reconciliation",
    href: "/dealer/stock-reporting/monetary",
  },
] as const;
