import { litresToCents, centsToLitres } from "./pump-calc";

export type ProductCodeLite = "PMS" | "AGO";

export type IntelligenceConfigValues = {
  pmsDailyTargetLitres: number | null;
  agoDailyTargetLitres: number | null;
  pmsWeeklyTargetLitres: number | null;
  agoWeeklyTargetLitres: number | null;
  pmsMonthlyTargetLitres: number | null;
  agoMonthlyTargetLitres: number | null;
  pmsYearlyTargetLitres: number | null;
  agoYearlyTargetLitres: number | null;
  pmsMinHoldingLitres: number | null;
  agoMinHoldingLitres: number | null;
  pmsTwoDayHoldingLitres: number | null;
  agoTwoDayHoldingLitres: number | null;
  pmsWarningCoverDays: number;
  agoWarningCoverDays: number;
  pmsCriticalCoverDays: number;
  agoCriticalCoverDays: number;
};

export const EMPTY_INTELLIGENCE_CONFIG: IntelligenceConfigValues = {
  pmsDailyTargetLitres: null,
  agoDailyTargetLitres: null,
  pmsWeeklyTargetLitres: null,
  agoWeeklyTargetLitres: null,
  pmsMonthlyTargetLitres: null,
  agoMonthlyTargetLitres: null,
  pmsYearlyTargetLitres: null,
  agoYearlyTargetLitres: null,
  pmsMinHoldingLitres: null,
  agoMinHoldingLitres: null,
  pmsTwoDayHoldingLitres: null,
  agoTwoDayHoldingLitres: null,
  pmsWarningCoverDays: 3,
  agoWarningCoverDays: 3,
  pmsCriticalCoverDays: 1,
  agoCriticalCoverDays: 1,
};

export type TankLevelView = {
  id: string;
  tankKey: string;
  label: string;
  product: ProductCodeLite;
  capacityLitres: number;
  currentLitres: number;
  fillPct: number;
  overCapacity: boolean;
  updatedAt: string | null;
};

export type HoldingStatus = "healthy" | "warning" | "critical" | "insufficient";

export type ProductHoldingRow = {
  product: ProductCodeLite;
  currentStock: number;
  avgDailySales: number | null;
  daysOfCover: number | null;
  minHolding: number | null;
  twoDayHolding: number | null;
  status: HoldingStatus;
};

export type PeriodKey = "day" | "week" | "month" | "year";

export type SalesPerfRow = {
  product: ProductCodeLite;
  actual: number;
  target: number | null;
  achievementPct: number | null;
  provisional: boolean;
};

export type ProjectionStatus = "on_track" | "at_risk" | "below" | "insufficient";

export type ProjectionRow = {
  period: PeriodKey;
  label: string;
  target: number | null;
  actualToDate: number;
  projection: number | null;
  status: ProjectionStatus;
};

/** Modal / planning convention: week×7, month×30, year×365. */
export const TARGET_PERIOD_DIVISORS = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
} as const;

export function derivePeriodTarget(
  daily: number | null,
  explicit: number | null,
  multiplier: number
): number | null {
  if (explicit != null && Number.isFinite(explicit)) return explicit;
  if (daily != null && Number.isFinite(daily)) return daily * multiplier;
  return null;
}

/** Convert an edited period field back to a daily rate (modal uses ÷7 / ÷30 / ÷365). */
export function dailyFromPeriodValue(
  period: PeriodKey,
  value: number | null
): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const div = TARGET_PERIOD_DIVISORS[period];
  const raw = div === 1 ? value : value / div;
  return Math.round(raw * 1000) / 1000;
}

/**
 * Editing any period field sets daily from that value and clears longer-period
 * overrides so week/month/year immediately re-derive from the daily rate.
 */
export function cascadeTargetsFromPeriodEdit(
  cfg: IntelligenceConfigValues,
  product: ProductCodeLite,
  period: PeriodKey,
  value: number | null
): IntelligenceConfigValues {
  const daily = dailyFromPeriodValue(period, value);
  if (product === "PMS") {
    return {
      ...cfg,
      pmsDailyTargetLitres: daily,
      pmsWeeklyTargetLitres: null,
      pmsMonthlyTargetLitres: null,
      pmsYearlyTargetLitres: null,
    };
  }
  return {
    ...cfg,
    agoDailyTargetLitres: daily,
    agoWeeklyTargetLitres: null,
    agoMonthlyTargetLitres: null,
    agoYearlyTargetLitres: null,
  };
}

export function resolvedTargets(cfg: IntelligenceConfigValues) {
  const pmsDaily = cfg.pmsDailyTargetLitres;
  const agoDaily = cfg.agoDailyTargetLitres;
  return {
    pms: {
      day: pmsDaily,
      week: derivePeriodTarget(pmsDaily, cfg.pmsWeeklyTargetLitres, 7),
      month: derivePeriodTarget(pmsDaily, cfg.pmsMonthlyTargetLitres, 30),
      year: derivePeriodTarget(pmsDaily, cfg.pmsYearlyTargetLitres, 365),
    },
    ago: {
      day: agoDaily,
      week: derivePeriodTarget(agoDaily, cfg.agoWeeklyTargetLitres, 7),
      month: derivePeriodTarget(agoDaily, cfg.agoMonthlyTargetLitres, 30),
      year: derivePeriodTarget(agoDaily, cfg.agoYearlyTargetLitres, 365),
    },
    combinedDaily:
      pmsDaily != null || agoDaily != null
        ? (pmsDaily ?? 0) + (agoDaily ?? 0)
        : null,
  };
}

/**
 * Target used for live period comparisons. Monthly/yearly use the actual day
 * count of that calendar period (not the modal ×30 / ×365 planning figures).
 * Explicit stored overrides still win when present.
 */
export function comparisonPeriodTarget(params: {
  daily: number | null;
  explicit: number | null;
  period: PeriodKey;
  periodDayCount: number;
}): number | null {
  if (params.explicit != null && Number.isFinite(params.explicit)) return params.explicit;
  if (params.daily == null || !Number.isFinite(params.daily)) return null;
  if (params.period === "day") return params.daily;
  const days = Math.max(0, params.periodDayCount);
  return params.daily * days;
}

export function achievementPct(actual: number, target: number | null): number | null {
  if (target == null || !Number.isFinite(target) || Math.abs(target) < 0.0005) return null;
  return (actual / target) * 100;
}

export function daysOfCover(stock: number, avgDaily: number | null): number | null {
  if (avgDaily == null || !Number.isFinite(avgDaily) || avgDaily <= 0.0005) return null;
  return stock / avgDaily;
}

export function classifyHolding(params: {
  stock: number;
  daysOfCover: number | null;
  minHolding: number | null;
  warningDays: number;
  criticalDays: number;
  hasSalesHistory: boolean;
}): HoldingStatus {
  if (!params.hasSalesHistory && params.stock <= 0) return "insufficient";
  if (params.daysOfCover == null && params.minHolding == null) {
    return params.stock > 0 ? "insufficient" : "insufficient";
  }
  if (params.minHolding != null && params.stock + 0.0005 < params.minHolding) return "critical";
  if (params.daysOfCover != null && params.daysOfCover <= params.criticalDays) return "critical";
  if (params.daysOfCover != null && params.daysOfCover <= params.warningDays) return "warning";
  if (params.minHolding != null && params.stock < params.minHolding * 1.15) return "warning";
  if (params.daysOfCover == null) return "insufficient";
  return "healthy";
}

export function classifyProjection(params: {
  target: number | null;
  projection: number | null;
  atRiskBand?: number;
}): ProjectionStatus {
  const { target, projection, atRiskBand = 0.95 } = params;
  if (target == null || projection == null) return "insufficient";
  if (projection + 0.0005 >= target) return "on_track";
  if (projection >= target * atRiskBand) return "at_risk";
  return "below";
}

/**
 * Project remaining period using recent average daily sales.
 * remainingDays includes today if elapsedDays is floor of days so far.
 */
export function projectPeriodSales(params: {
  actualToDate: number;
  avgDailySales: number | null;
  remainingDays: number;
}): number | null {
  if (params.avgDailySales == null || !Number.isFinite(params.avgDailySales)) return null;
  const rem = Math.max(0, params.remainingDays);
  return centsToLitres(
    litresToCents(params.actualToDate) + litresToCents(params.avgDailySales * rem)
  );
}

export function buildTankLevels(
  tanks: {
    id: string;
    tankKey: string;
    label: string;
    product: string;
    capacityLitres: number;
    lastClosingLitres: number;
    updatedAt: Date;
  }[]
): TankLevelView[] {
  return tanks
    .filter((t) => t.product === "PMS" || t.product === "AGO")
    .map((t) => {
      const capacity = t.capacityLitres > 0 ? t.capacityLitres : 0;
      const current = Math.max(0, t.lastClosingLitres);
      const overCapacity = capacity > 0 && current > capacity + 0.0005;
      const fillPct =
        capacity <= 0 ? 0 : Math.min(100, Math.max(0, (current / capacity) * 100));
      return {
        id: t.id,
        tankKey: t.tankKey,
        label: t.label,
        product: t.product as ProductCodeLite,
        capacityLitres: capacity,
        currentLitres: current,
        fillPct,
        overCapacity,
        updatedAt: t.updatedAt?.toISOString() ?? null,
      };
    });
}

export function sumStockByProduct(tanks: TankLevelView[], product: ProductCodeLite): number {
  let c = 0;
  for (const t of tanks) {
    if (t.product === product) c += litresToCents(t.currentLitres);
  }
  return centsToLitres(c);
}

export function averageDailySalesFromReports(
  reports: { meterSalesPmsLitres: number | null; meterSalesAgoLitres: number | null }[],
  product: ProductCodeLite
): number | null {
  if (reports.length === 0) return null;
  let totalC = 0;
  for (const r of reports) {
    const v = product === "PMS" ? r.meterSalesPmsLitres : r.meterSalesAgoLitres;
    if (v != null && Number.isFinite(v)) totalC += litresToCents(v);
  }
  return centsToLitres(totalC / reports.length);
}

export function sumSalesFromReports(
  reports: { meterSalesPmsLitres: number | null; meterSalesAgoLitres: number | null }[],
  product: ProductCodeLite
): number {
  let c = 0;
  for (const r of reports) {
    const v = product === "PMS" ? r.meterSalesPmsLitres : r.meterSalesAgoLitres;
    if (v != null && Number.isFinite(v)) c += litresToCents(v);
  }
  return centsToLitres(c);
}

export function stationStockCoverDays(
  pms: ProductHoldingRow,
  ago: ProductHoldingRow
): number | null {
  const covers = [pms.daysOfCover, ago.daysOfCover].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (covers.length === 0) return null;
  return Math.min(...covers);
}

export function formatCoverDays(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Days`;
}

export function formatPctRound(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function remainingDaysInPeriod(params: {
  period: PeriodKey;
  /** Inclusive start UTC date */
  start: Date;
  /** Exclusive end */
  endExclusive: Date;
  /** Nairobi business "today" UTC date */
  today: Date;
}): number {
  const todayMs = params.today.getTime();
  const startMs = params.start.getTime();
  const endMs = params.endExclusive.getTime();
  if (todayMs < startMs) return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
  if (todayMs >= endMs) return 0;
  return Math.max(0, Math.round((endMs - todayMs) / 86_400_000) - 1);
}
