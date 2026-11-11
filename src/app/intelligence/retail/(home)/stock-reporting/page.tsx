import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  StaffStockReconciliationDashboard,
  type StaffReconViewModel,
} from "@/components/staff/staff-stock-reconciliation";
import {
  aggregateStaffReconciliation,
  completenessLabel,
  defaultStaffReportDate,
  expectedReportDaysInRange,
  parseIsoDateParam,
  countNairobiDaysInRange,
  resolvePeriodBounds,
  toIsoDateParam,
  type StaffReportingPeriod,
} from "@/lib/stock-reporting/staff-reconciliation";
import {
  achievementPct,
  averageDailySalesFromReports,
  buildTankLevels,
  classifyHolding,
  classifyProjection,
  comparisonPeriodTarget,
  daysOfCover,
  EMPTY_INTELLIGENCE_CONFIG,
  projectPeriodSales,
  remainingDaysInPeriod,
  resolvedTargets,
  stationStockCoverDays,
  sumSalesFromReports,
  sumStockByProduct,
  type PeriodKey,
} from "@/lib/stock-reporting/staff-stock-intelligence";
import type { StaffIntelligenceViewModel } from "@/components/staff/staff-stock-intelligence";
import type { StaffMonetaryViewModel } from "@/components/staff/staff-monetary-sales";
import type { StaffUser } from "@/lib/permissions";
import { nairobiBusinessDate } from "@/lib/stock-reporting/dates";
import { ensureStationTanks } from "@/lib/stock-reporting/tanks";
import {
  aggregateStaffMonetary,
  buildDailyRevenueTrend,
  buildTargetVsActual,
  monetaryTargetKes,
  paymentMethodSlices,
  type MonetaryReportSlice,
} from "@/lib/stock-reporting/staff-monetary-sales";
import { resolvedTargets as resolveVolumeTargets } from "@/lib/stock-reporting/staff-stock-intelligence";
import { ensureOfficialStationsInDb } from "@/lib/dealers/ensure-official-stations";

export const dynamic = "force-dynamic";

type Search = {
  station?: string;
  period?: string;
  date?: string;
  from?: string;
  to?: string;
  section?: string;
  intelPeriod?: string;
};

function parsePeriod(raw: string | undefined): StaffReportingPeriod {
  if (raw === "week" || raw === "month" || raw === "year" || raw === "custom" || raw === "day") {
    return raw;
  }
  return "day";
}

function parseSection(raw: string | undefined): StaffReconViewModel["section"] {
  if (raw === "intelligence" || raw === "monetary") return raw;
  return "reconciliation";
}

function formatUpdatedAt(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseIntelPeriod(raw: string | undefined): PeriodKey {
  if (raw === "week" || raw === "month" || raw === "year" || raw === "day") return raw;
  return "day";
}

function asNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function toMonetarySlice(r: {
  reportingDate: Date;
  status: "DRAFT" | "CLOSED";
  meterSalesPmsLitres: number | null;
  meterSalesAgoLitres: number | null;
  sellingPricePmsKes: unknown;
  sellingPriceAgoKes: unknown;
  expectedPmsKes: unknown;
  expectedAgoKes: unknown;
  expectedRevenueKes: unknown;
  cashCollectionsKes: unknown;
  mpesaCollectionsKes: unknown;
  cardCollectionsKes: unknown;
  collectionsKes: unknown;
  monetaryDifferenceKes: unknown;
  monetaryDiscrepancyReason: string | null;
}): MonetaryReportSlice {
  return {
    reportingDate: r.reportingDate,
    status: r.status,
    meterSalesPmsLitres: r.meterSalesPmsLitres,
    meterSalesAgoLitres: r.meterSalesAgoLitres,
    sellingPricePmsKes: asNum(r.sellingPricePmsKes as never),
    sellingPriceAgoKes: asNum(r.sellingPriceAgoKes as never),
    expectedPmsKes: asNum(r.expectedPmsKes as never),
    expectedAgoKes: asNum(r.expectedAgoKes as never),
    expectedRevenueKes: asNum(r.expectedRevenueKes as never),
    cashCollectionsKes: asNum(r.cashCollectionsKes as never),
    mpesaCollectionsKes: asNum(r.mpesaCollectionsKes as never),
    cardCollectionsKes: asNum(r.cardCollectionsKes as never),
    collectionsKes: asNum(r.collectionsKes as never),
    monetaryDifferenceKes: asNum(r.monetaryDifferenceKes as never),
    monetaryDiscrepancyReason: r.monetaryDiscrepancyReason,
  };
}

async function loadMonetary(params: {
  stationId: string;
  stationName: string;
  period: StaffReportingPeriod;
  date: Date;
  from: Date;
  to: Date;
  bounds: { start: Date; endExclusive: Date; label: string };
  today: Date;
}): Promise<StaffMonetaryViewModel> {
  const { stationId, stationName, period, date, from, to, bounds, today } = params;

  const [reports, configRow, trendReports] = await Promise.all([
    prisma.stockSaleReport.findMany({
      where: {
        stationId,
        reportingDate: { gte: bounds.start, lt: bounds.endExclusive },
      },
      orderBy: { reportingDate: "asc" },
    }),
    prisma.stationStockIntelligenceConfig.findFirst({
      where: { stationId, effectiveFrom: { lte: today } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.stockSaleReport.findMany({
      where: {
        stationId,
        status: "CLOSED",
        reportingDate: {
          gte: new Date(today.getTime() - 6 * 86_400_000),
          lt: new Date(today.getTime() + 86_400_000),
        },
      },
      orderBy: { reportingDate: "asc" },
    }),
  ]);

  const slices = reports.map(toMonetarySlice);
  const summary = aggregateStaffMonetary(slices);
  const closed = slices.filter((r) => r.status === "CLOSED");

  const cfg = configRow
    ? {
        pmsDailyTargetLitres: configRow.pmsDailyTargetLitres,
        agoDailyTargetLitres: configRow.agoDailyTargetLitres,
        pmsWeeklyTargetLitres: configRow.pmsWeeklyTargetLitres,
        agoWeeklyTargetLitres: configRow.agoWeeklyTargetLitres,
        pmsMonthlyTargetLitres: configRow.pmsMonthlyTargetLitres,
        agoMonthlyTargetLitres: configRow.agoMonthlyTargetLitres,
        pmsYearlyTargetLitres: configRow.pmsYearlyTargetLitres,
        agoYearlyTargetLitres: configRow.agoYearlyTargetLitres,
        pmsMinHoldingLitres: configRow.pmsMinHoldingLitres,
        agoMinHoldingLitres: configRow.agoMinHoldingLitres,
        pmsTwoDayHoldingLitres: configRow.pmsTwoDayHoldingLitres,
        agoTwoDayHoldingLitres: configRow.agoTwoDayHoldingLitres,
        pmsWarningCoverDays: configRow.pmsWarningCoverDays,
        agoWarningCoverDays: configRow.agoWarningCoverDays,
        pmsCriticalCoverDays: configRow.pmsCriticalCoverDays,
        agoCriticalCoverDays: configRow.agoCriticalCoverDays,
      }
    : EMPTY_INTELLIGENCE_CONFIG;

  const volTargets = resolveVolumeTargets(cfg);
  const pricePms =
    summary.pms.weightedAveragePrice ??
    closed.map((r) => r.sellingPricePmsKes).find((p) => p != null) ??
    null;
  const priceAgo =
    summary.ago.weightedAveragePrice ??
    closed.map((r) => r.sellingPriceAgoKes).find((p) => p != null) ??
    null;

  const periodKey: PeriodKey =
    period === "custom" ? "day" : period === "week" || period === "month" || period === "year" || period === "day"
      ? period
      : "day";

  // Compare against daily × actual days in the selected period (esp. real month length).
  const dayCount = Math.max(1, countNairobiDaysInRange(bounds.start, bounds.endExclusive));
  const explicitFor = (
    product: "PMS" | "AGO",
    key: PeriodKey
  ): number | null => {
    if (key === "week") {
      return product === "PMS" ? cfg.pmsWeeklyTargetLitres : cfg.agoWeeklyTargetLitres;
    }
    if (key === "month") {
      return product === "PMS" ? cfg.pmsMonthlyTargetLitres : cfg.agoMonthlyTargetLitres;
    }
    if (key === "year") {
      return product === "PMS" ? cfg.pmsYearlyTargetLitres : cfg.agoYearlyTargetLitres;
    }
    return null;
  };
  const pmsVol =
    period === "custom"
      ? comparisonPeriodTarget({
          daily: volTargets.pms.day,
          explicit: null,
          period: "month",
          periodDayCount: dayCount,
        })
      : comparisonPeriodTarget({
          daily: cfg.pmsDailyTargetLitres,
          explicit: explicitFor("PMS", periodKey),
          period: periodKey,
          periodDayCount: dayCount,
        });
  const agoVol =
    period === "custom"
      ? comparisonPeriodTarget({
          daily: volTargets.ago.day,
          explicit: null,
          period: "month",
          periodDayCount: dayCount,
        })
      : comparisonPeriodTarget({
          daily: cfg.agoDailyTargetLitres,
          explicit: explicitFor("AGO", periodKey),
          period: periodKey,
          periodDayCount: dayCount,
        });

  const pmsTarget = monetaryTargetKes({ volumeTarget: pmsVol, priceKesPerLitre: pricePms });
  const agoTarget = monetaryTargetKes({ volumeTarget: agoVol, priceKesPerLitre: priceAgo });
  const periodTarget =
    pmsTarget != null || agoTarget != null ? (pmsTarget ?? 0) + (agoTarget ?? 0) : null;

  const dailyPms = monetaryTargetKes({
    volumeTarget: volTargets.pms.day,
    priceKesPerLitre: pricePms,
  });
  const dailyAgo = monetaryTargetKes({
    volumeTarget: volTargets.ago.day,
    priceKesPerLitre: priceAgo,
  });
  const dailyCombined =
    dailyPms != null || dailyAgo != null ? (dailyPms ?? 0) + (dailyAgo ?? 0) : null;

  const targetRows = buildTargetVsActual({
    pmsActual: summary.pms.revenueKes,
    agoActual: summary.ago.revenueKes,
    pmsTarget,
    agoTarget,
  });

  const trendDays: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    trendDays.push(new Date(today.getTime() - i * 86_400_000));
  }
  const trend = buildDailyRevenueTrend({
    closed: trendReports.map(toMonetarySlice),
    days: trendDays,
    dailyTargetKes: dailyCombined,
  });

  const qs = new URLSearchParams({
    station: stationId,
    period,
    date: toIsoDateParam(date),
    ...(period === "custom"
      ? { from: toIsoDateParam(from), to: toIsoDateParam(to) }
      : {}),
  });

  return {
    stationId,
    stationName,
    period,
    periodLabel: bounds.label,
    dateIso: toIsoDateParam(date),
    fromIso: toIsoDateParam(from),
    toIso: toIsoDateParam(to),
    pms: summary.pms,
    ago: summary.ago,
    totalVolume: summary.totalVolume,
    totalRevenueKes: summary.totalRevenueKes,
    totalCollectionsKes: summary.totalCollectionsKes,
    monetaryVarianceKes: summary.monetaryVarianceKes,
    dailyTargetKes: period === "day" ? dailyCombined : periodTarget,
    targetAchievementPct: achievementPct(
      summary.totalRevenueKes,
      period === "day" ? dailyCombined : periodTarget
    ),
    payments: paymentMethodSlices(summary),
    targetRows,
    trend,
    reportsIncluded: summary.reportsIncluded,
    shiftsHref: `/intelligence/retail/stock-reporting/shifts?${qs.toString()}`,
    exportBase: `/api/intelligence/stock-reporting/export?${qs.toString()}&section=monetary`,
  };
}

async function loadIntelligence(params: {
  stationId: string;
  stationName: string;
  dealerName: string;
  user: StaffUser & { role?: string | null };
  intelPeriod: PeriodKey;
  today: Date;
}): Promise<StaffIntelligenceViewModel> {
  const { stationId, stationName, dealerName, user, intelPeriod, today } = params;
  await ensureStationTanks(stationId).catch(() => null);

  const lookbackStart = new Date(today.getTime() - 14 * 86_400_000);
  const [
    tanksRaw,
    configRow,
    closedLookback,
    todayReports,
    openOrdersInTransit,
  ] = await Promise.all([
    prisma.stationTank.findMany({
      where: { stationId, active: true },
      orderBy: [{ sortOrder: "asc" }, { tankKey: "asc" }],
    }),
    prisma.stationStockIntelligenceConfig.findFirst({
      where: { stationId, effectiveFrom: { lte: today } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.stockSaleReport.findMany({
      where: {
        stationId,
        status: "CLOSED",
        reportingDate: { gte: lookbackStart, lt: new Date(today.getTime() + 86_400_000) },
      },
      select: {
        reportingDate: true,
        meterSalesPmsLitres: true,
        meterSalesAgoLitres: true,
        updatedAt: true,
        closedAt: true,
      },
      orderBy: { reportingDate: "asc" },
    }),
    prisma.stockSaleReport.findMany({
      where: { stationId, reportingDate: today },
      select: {
        status: true,
        meterSalesPmsLitres: true,
        meterSalesAgoLitres: true,
        updatedAt: true,
        closedAt: true,
      },
    }),
    prisma.dealerOrder.count({
      where: {
        stationId,
        status: { in: ["DISPATCHED", "IN_TRANSIT", "LOADED", "LOADING", "RELEASED_TO_DEPOT"] },
      },
    }),
  ]);

  const tanks = buildTankLevels(tanksRaw);
  const totalStock = sumStockByProduct(tanks, "PMS") + sumStockByProduct(tanks, "AGO");
  const latestTankAt = tanksRaw.reduce<Date | null>((acc, t) => {
    if (!acc || t.updatedAt > acc) return t.updatedAt;
    return acc;
  }, null);
  const stockSnapshotStale =
    latestTankAt != null && Date.now() - latestTankAt.getTime() > 36 * 60 * 60 * 1000;

  const config = configRow
    ? {
        pmsDailyTargetLitres: configRow.pmsDailyTargetLitres,
        agoDailyTargetLitres: configRow.agoDailyTargetLitres,
        pmsWeeklyTargetLitres: configRow.pmsWeeklyTargetLitres,
        agoWeeklyTargetLitres: configRow.agoWeeklyTargetLitres,
        pmsMonthlyTargetLitres: configRow.pmsMonthlyTargetLitres,
        agoMonthlyTargetLitres: configRow.agoMonthlyTargetLitres,
        pmsYearlyTargetLitres: configRow.pmsYearlyTargetLitres,
        agoYearlyTargetLitres: configRow.agoYearlyTargetLitres,
        pmsMinHoldingLitres: configRow.pmsMinHoldingLitres,
        agoMinHoldingLitres: configRow.agoMinHoldingLitres,
        pmsTwoDayHoldingLitres: configRow.pmsTwoDayHoldingLitres,
        agoTwoDayHoldingLitres: configRow.agoTwoDayHoldingLitres,
        pmsWarningCoverDays: configRow.pmsWarningCoverDays,
        agoWarningCoverDays: configRow.agoWarningCoverDays,
        pmsCriticalCoverDays: configRow.pmsCriticalCoverDays,
        agoCriticalCoverDays: configRow.agoCriticalCoverDays,
      }
    : EMPTY_INTELLIGENCE_CONFIG;

  const targets = resolvedTargets(config);
  const avgPms = averageDailySalesFromReports(closedLookback, "PMS");
  const avgAgo = averageDailySalesFromReports(closedLookback, "AGO");

  const todayClosed = todayReports.filter((r) => r.status === "CLOSED");
  const todayDraft = todayReports.some((r) => r.status === "DRAFT");
  const todaySalesPms = sumSalesFromReports(todayClosed, "PMS");
  const todaySalesAgo = sumSalesFromReports(todayClosed, "AGO");
  const todaySales = todaySalesPms + todaySalesAgo;
  const dailyTarget = targets.combinedDaily;
  const targetAchievementPct = achievementPct(todaySales, dailyTarget);

  const pmsStock = sumStockByProduct(tanks, "PMS");
  const agoStock = sumStockByProduct(tanks, "AGO");
  const pmsCover = daysOfCover(pmsStock, avgPms);
  const agoCover = daysOfCover(agoStock, avgAgo);

  const twoDayPms =
    config.pmsTwoDayHoldingLitres ??
    (avgPms != null ? avgPms * 2 : null);
  const twoDayAgo =
    config.agoTwoDayHoldingLitres ??
    (avgAgo != null ? avgAgo * 2 : null);

  const holdings = [
    {
      product: "PMS" as const,
      currentStock: pmsStock,
      avgDailySales: avgPms,
      daysOfCover: pmsCover,
      minHolding: config.pmsMinHoldingLitres,
      twoDayHolding: twoDayPms,
      status: classifyHolding({
        stock: pmsStock,
        daysOfCover: pmsCover,
        minHolding: config.pmsMinHoldingLitres,
        warningDays: config.pmsWarningCoverDays,
        criticalDays: config.pmsCriticalCoverDays,
        hasSalesHistory: avgPms != null,
      }),
    },
    {
      product: "AGO" as const,
      currentStock: agoStock,
      avgDailySales: avgAgo,
      daysOfCover: agoCover,
      minHolding: config.agoMinHoldingLitres,
      twoDayHolding: twoDayAgo,
      status: classifyHolding({
        stock: agoStock,
        daysOfCover: agoCover,
        minHolding: config.agoMinHoldingLitres,
        warningDays: config.agoWarningCoverDays,
        criticalDays: config.agoCriticalCoverDays,
        hasSalesHistory: avgAgo != null,
      }),
    },
  ];

  const salesBounds = resolvePeriodBounds({ period: intelPeriod, date: today });
  const periodClosed = closedLookback.filter(
    (r) => r.reportingDate >= salesBounds.start && r.reportingDate < salesBounds.endExclusive
  );
  const salesPeriodDays = countNairobiDaysInRange(salesBounds.start, salesBounds.endExclusive);
  const salesPerf = (["PMS", "AGO"] as const).map((product) => {
    const actual = sumSalesFromReports(periodClosed, product);
    const daily = product === "PMS" ? config.pmsDailyTargetLitres : config.agoDailyTargetLitres;
    const explicit =
      intelPeriod === "week"
        ? product === "PMS"
          ? config.pmsWeeklyTargetLitres
          : config.agoWeeklyTargetLitres
        : intelPeriod === "month"
          ? product === "PMS"
            ? config.pmsMonthlyTargetLitres
            : config.agoMonthlyTargetLitres
          : intelPeriod === "year"
            ? product === "PMS"
              ? config.pmsYearlyTargetLitres
              : config.agoYearlyTargetLitres
            : null;
    const target = comparisonPeriodTarget({
      daily,
      explicit,
      period: intelPeriod,
      periodDayCount: salesPeriodDays,
    });
    return {
      product,
      actual,
      target,
      achievementPct: achievementPct(actual, target),
      provisional: intelPeriod === "day" && todayDraft && todayClosed.length === 0,
    };
  });

  const avgCombined =
    avgPms != null || avgAgo != null ? (avgPms ?? 0) + (avgAgo ?? 0) : null;

  const periodDefs: { key: PeriodKey; label: string }[] = [
    { key: "day", label: "Daily" },
    { key: "week", label: "Weekly" },
    { key: "month", label: "Monthly" },
    { key: "year", label: "Yearly" },
  ];

  const projections = periodDefs.map(({ key, label }) => {
    const b = resolvePeriodBounds({ period: key, date: today });
    const periodDays = countNairobiDaysInRange(b.start, b.endExclusive);
    const actualToDate = sumSalesFromReports(
      closedLookback.filter(
        (r) => r.reportingDate >= b.start && r.reportingDate < b.endExclusive
      ),
      "PMS"
    ) + sumSalesFromReports(
      closedLookback.filter(
        (r) => r.reportingDate >= b.start && r.reportingDate < b.endExclusive
      ),
      "AGO"
    );
    const pmsTarget = comparisonPeriodTarget({
      daily: config.pmsDailyTargetLitres,
      explicit:
        key === "week"
          ? config.pmsWeeklyTargetLitres
          : key === "month"
            ? config.pmsMonthlyTargetLitres
            : key === "year"
              ? config.pmsYearlyTargetLitres
              : null,
      period: key,
      periodDayCount: periodDays,
    });
    const agoTarget = comparisonPeriodTarget({
      daily: config.agoDailyTargetLitres,
      explicit:
        key === "week"
          ? config.agoWeeklyTargetLitres
          : key === "month"
            ? config.agoMonthlyTargetLitres
            : key === "year"
              ? config.agoYearlyTargetLitres
              : null,
      period: key,
      periodDayCount: periodDays,
    });
    const targetVal =
      pmsTarget != null || agoTarget != null ? (pmsTarget ?? 0) + (agoTarget ?? 0) : null;
    const rem = remainingDaysInPeriod({
      period: key,
      start: b.start,
      endExclusive: b.endExclusive,
      today,
    });
    const projection = projectPeriodSales({
      actualToDate,
      avgDailySales: avgCombined,
      remainingDays: rem,
    });
    return {
      period: key,
      label,
      target: targetVal,
      actualToDate,
      projection,
      status: classifyProjection({ target: targetVal, projection }),
    };
  });

  const monthBounds = resolvePeriodBounds({ period: "month", date: today });
  const yearBounds = resolvePeriodBounds({ period: "year", date: today });
  const monthDays = countNairobiDaysInRange(monthBounds.start, monthBounds.endExclusive);
  const yearDays = countNairobiDaysInRange(yearBounds.start, yearBounds.endExclusive);

  const forecast = (["PMS", "AGO"] as const).map((product) => {
    const avg = product === "PMS" ? avgPms : avgAgo;
    const daily = product === "PMS" ? config.pmsDailyTargetLitres : config.agoDailyTargetLitres;
    const weekTarget = comparisonPeriodTarget({
      daily,
      explicit: product === "PMS" ? config.pmsWeeklyTargetLitres : config.agoWeeklyTargetLitres,
      period: "week",
      periodDayCount: 7,
    });
    const monthTarget = comparisonPeriodTarget({
      daily,
      explicit: product === "PMS" ? config.pmsMonthlyTargetLitres : config.agoMonthlyTargetLitres,
      period: "month",
      periodDayCount: monthDays,
    });
    const yearTarget = comparisonPeriodTarget({
      daily,
      explicit: product === "PMS" ? config.pmsYearlyTargetLitres : config.agoYearlyTargetLitres,
      period: "year",
      periodDayCount: yearDays,
    });
    const meets = (periodTarget: number | null, days: number) => {
      if (avg == null || periodTarget == null) return null;
      return avg * days + 0.0005 >= periodTarget;
    };
    const weekOk = meets(weekTarget, 7);
    const monthOk = meets(monthTarget, monthDays);
    const yearOk = meets(yearTarget, yearDays);
    let status: StaffIntelligenceViewModel["forecast"][number]["status"] = "insufficient";
    if (avg != null && (weekTarget != null || monthTarget != null || yearTarget != null)) {
      if (weekOk && monthOk && yearOk) status = "on_track";
      else if (weekOk || monthOk) status = "at_risk";
      else status = "below";
    }
    return {
      product,
      avgDaily: avg,
      status,
      meetsWeekly: weekOk,
      meetsMonthly: monthOk,
      meetsYearly: yearOk,
    };
  });

  const latestReportAt =
    [...todayClosed, ...closedLookback]
      .map((r) => r.closedAt ?? r.updatedAt)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? latestTankAt;

  return {
    stationId,
    stationName,
    dealerName,
    canEditTargets:
      user.role === "SUPER_ADMIN" ||
      canUser(user, "settings", "view") ||
      canUser(user, "orders", "act"),
    canMessage: canUser(user, "messaging", "view"),
    lastReportLabel: formatUpdatedAt(latestReportAt),
    stockSnapshotStale,
    totalTanks: tanks.length,
    totalStock,
    todaySales,
    todaySalesProvisional: todayDraft && todayClosed.length === 0,
    dailyTarget,
    targetAchievementPct,
    stockCoverDays: stationStockCoverDays(holdings[0]!, holdings[1]!),
    tanks,
    salesPerf,
    salesPeriod: intelPeriod,
    projections,
    holdings,
    forecast,
    config,
    openOrdersInTransit,
  };
}

async function loadView(
  search: Search,
  user: StaffUser & { role?: string | null }
): Promise<StaffReconViewModel> {
  const period = parsePeriod(search.period);
  const section = parseSection(search.section);
  const intelPeriod = parseIntelPeriod(search.intelPeriod);
  const date = parseIsoDateParam(search.date) ?? defaultStaffReportDate();
  const from = parseIsoDateParam(search.from) ?? date;
  const to = parseIsoDateParam(search.to) ?? date;
  const bounds = resolvePeriodBounds({ period, date, from, to });
  const today = nairobiBusinessDate();

  // Official catalog has ~22 stations; local DBs often only have activated ones.
  await ensureOfficialStationsInDb();

  const stations = await prisma.station.findMany({
    select: {
      id: true,
      name: true,
      tradingName: true,
      dealerOrganization: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  if (stations.length === 0) {
    const emptyRow = {
      product: "PMS" as const,
      opening: 0,
      received: 0,
      available: 0,
      sales: 0,
      expectedClosing: 0,
      actualClosing: 0,
      variance: 0,
      variancePct: null,
    };
    return {
      section,
      stationId: "",
      stationName: "No stations",
      dealerName: "—",
      period,
      dateIso: toIsoDateParam(date),
      fromIso: toIsoDateParam(from),
      toIso: toIsoDateParam(to),
      periodLabel: bounds.label,
      completeness: { status: "none", label: "No Reports" },
      expectedDays: 0,
      closedDays: 0,
      reportsIncluded: 0,
      lastUpdatedLabel: null,
      lossReason: null,
      rows: [emptyRow, { ...emptyRow, product: "AGO" }],
      total: emptyRow,
      totalSales: 0,
      netVariance: 0,
      netVariancePct: null,
      receiptsRecorded: false,
      stations: [],
      intelligence: null,
      monetary: null,
    };
  }

  const stationId =
    stations.find((s) => s.id === search.station)?.id ?? stations[0]!.id;
  const station = stations.find((s) => s.id === stationId)!;

  /** Station label = place name (Banana); dealer org stays separate. */
  function displayStationName(s: { name: string }) {
    return s.name;
  }

  const stationName = displayStationName(station);

  const periodReportsMeta = await prisma.stockSaleReport.findMany({
    where: {
      reportingDate: { gte: bounds.start, lt: bounds.endExclusive },
    },
    select: {
      stationId: true,
      status: true,
      reportingDate: true,
    },
  });

  const stationOptions = stations
    .map((s) => {
      const mine = periodReportsMeta.filter((r) => r.stationId === s.id);
      return {
        id: s.id,
        name: displayStationName(s),
        dealerName: s.dealerOrganization.name,
        hasClosedInPeriod: mine.some((r) => r.status === "CLOSED"),
        hasDraftInPeriod: mine.some((r) => r.status === "DRAFT"),
      };
    })
    .sort((a, b) => {
      const d = a.dealerName.localeCompare(b.dealerName, undefined, { sensitivity: "base" });
      return d !== 0 ? d : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const reports = await prisma.stockSaleReport.findMany({
    where: {
      stationId,
      reportingDate: { gte: bounds.start, lt: bounds.endExclusive },
    },
    include: {
      tankReadings: {
        select: {
          product: true,
          openingLitres: true,
          closingLitres: true,
        },
      },
      pumpReadings: {
        select: {
          product: true,
          salesLitres: true,
        },
      },
    },
    orderBy: { reportingDate: "asc" },
  });

  const closed = reports.filter((r) => r.status === "CLOSED");
  const hasDraft = reports.some((r) => r.status === "DRAFT");
  const closedDayKeys = new Set(
    closed.map((r) => r.reportingDate.toISOString().slice(0, 10))
  );
  const expectedDaysRaw = expectedReportDaysInRange(bounds.start, bounds.endExclusive);
  const expectedDays = Math.max(1, expectedDaysRaw);
  const completeness = completenessLabel({
    expectedDays,
    closedDays: closedDayKeys.size,
    hasDraft,
  });

  const summary = aggregateStaffReconciliation(
    reports.map((r) => ({
      reportingDate: r.reportingDate,
      status: r.status,
      meterSalesPmsLitres: r.meterSalesPmsLitres,
      meterSalesAgoLitres: r.meterSalesAgoLitres,
      tankReadings: r.tankReadings,
      pumpReadings: r.pumpReadings,
    }))
  );

  const latest = [...reports].sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
  )[0];

  const lossReason =
    closed
      .map((r) => r.wetLossReason?.trim())
      .filter((x): x is string => Boolean(x))
      .at(-1) ?? null;

  const [intelligence, monetary] = await Promise.all([
    loadIntelligence({
      stationId,
      stationName,
      dealerName: station.dealerOrganization.name,
      user,
      intelPeriod,
      today,
    }),
    loadMonetary({
      stationId,
      stationName,
      period,
      date,
      from,
      to,
      bounds,
      today,
    }),
  ]);

  return {
    section,
    stationId,
    stationName,
    dealerName: station.dealerOrganization.name,
    period,
    dateIso: toIsoDateParam(date),
    fromIso: toIsoDateParam(from),
    toIso: toIsoDateParam(to),
    periodLabel: bounds.label,
    completeness,
    expectedDays: Math.max(1, expectedDays),
    closedDays: closedDayKeys.size,
    reportsIncluded: closed.length,
    lastUpdatedLabel: formatUpdatedAt(latest?.updatedAt ?? latest?.closedAt ?? null),
    lossReason,
    rows: summary.rows,
    total: summary.total,
    totalSales: summary.totalSales,
    netVariance: summary.netVariance,
    netVariancePct: summary.netVariancePct,
    receiptsRecorded: summary.receiptsRecorded,
    stations: stationOptions,
    intelligence,
    monetary,
  };
}

export default async function StaffStockReportingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view") && !canUser(session.user, "orders", "view")) {
    redirect("/intelligence/retail");
  }

  const params = await searchParams;
  const view = await loadView(params, session.user);

  return (
    <Suspense fallback={<div className="ssr ssr-placeholder">Loading stock reporting…</div>}>
      <StaffStockReconciliationDashboard {...view} />
    </Suspense>
  );
}
