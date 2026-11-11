import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  achievementPct,
  averageDailySalesFromReports,
  buildTankLevels,
  cascadeTargetsFromPeriodEdit,
  classifyHolding,
  classifyProjection,
  comparisonPeriodTarget,
  dailyFromPeriodValue,
  daysOfCover,
  derivePeriodTarget,
  EMPTY_INTELLIGENCE_CONFIG,
  projectPeriodSales,
  resolvedTargets,
  stationStockCoverDays,
  sumStockByProduct,
} from "./staff-stock-intelligence";

describe("targets & achievement", () => {
  it("derives weekly from daily when explicit missing", () => {
    assert.equal(derivePeriodTarget(2400, null, 7), 16800);
    assert.equal(derivePeriodTarget(2400, 15000, 7), 15000);
  });

  it("cascades weekly edit into daily and clears longer overrides", () => {
    const next = cascadeTargetsFromPeriodEdit(
      {
        ...EMPTY_INTELLIGENCE_CONFIG,
        pmsDailyTargetLitres: 500,
        pmsWeeklyTargetLitres: 4000,
        pmsMonthlyTargetLitres: 20000,
      },
      "PMS",
      "week",
      7000
    );
    assert.equal(next.pmsDailyTargetLitres, 1000);
    assert.equal(next.pmsWeeklyTargetLitres, null);
    assert.equal(next.pmsMonthlyTargetLitres, null);
    assert.equal(resolvedTargets(next).pms.week, 7000);
    assert.equal(resolvedTargets(next).pms.month, 30000);
    assert.equal(resolvedTargets(next).pms.year, 365000);
  });

  it("converts period inputs back to daily with ÷7 / ÷30 / ÷365", () => {
    assert.equal(dailyFromPeriodValue("week", 7000), 1000);
    assert.equal(dailyFromPeriodValue("month", 30000), 1000);
    assert.equal(dailyFromPeriodValue("year", 365000), 1000);
  });

  it("uses actual month day count for comparison targets", () => {
    assert.equal(
      comparisonPeriodTarget({
        daily: 1000,
        explicit: null,
        period: "month",
        periodDayCount: 31,
      }),
      31000
    );
    assert.equal(
      comparisonPeriodTarget({
        daily: 1000,
        explicit: null,
        period: "month",
        periodDayCount: 28,
      }),
      28000
    );
    assert.equal(
      comparisonPeriodTarget({
        daily: 1000,
        explicit: 25000,
        period: "month",
        periodDayCount: 31,
      }),
      25000
    );
  });

  it("computes achievement without dividing by zero", () => {
    assert.equal(achievementPct(1600, 2400)?.toFixed(2), "66.67");
    assert.equal(achievementPct(100, 0), null);
    assert.equal(achievementPct(100, null), null);
  });
});

describe("stock cover & holding", () => {
  it("matches 2300 / 1000 = 2.3 days", () => {
    assert.equal(daysOfCover(2300, 1000), 2.3);
  });

  it("classifies warning/critical from cover thresholds", () => {
    assert.equal(
      classifyHolding({
        stock: 2300,
        daysOfCover: 2.3,
        minHolding: 1500,
        warningDays: 3,
        criticalDays: 1,
        hasSalesHistory: true,
      }),
      "warning"
    );
    assert.equal(
      classifyHolding({
        stock: 800,
        daysOfCover: 0.8,
        minHolding: 1500,
        warningDays: 3,
        criticalDays: 1,
        hasSalesHistory: true,
      }),
      "critical"
    );
  });

  it("uses lowest product cover for station KPI", () => {
    const cover = stationStockCoverDays(
      { product: "PMS", currentStock: 2300, avgDailySales: 1000, daysOfCover: 2.3, minHolding: null, twoDayHolding: null, status: "warning" },
      { product: "AGO", currentStock: 2040, avgDailySales: 600, daysOfCover: 3.4, minHolding: null, twoDayHolding: null, status: "healthy" }
    );
    assert.equal(cover, 2.3);
  });
});

describe("tanks & sales", () => {
  it("sums stock consistently and clamps fill", () => {
    const tanks = buildTankLevels([
      {
        id: "1",
        tankKey: "PMS-1",
        label: "PMS 1",
        product: "PMS",
        capacityLitres: 20000,
        lastClosingLitres: 15000,
        updatedAt: new Date(),
      },
      {
        id: "2",
        tankKey: "PMS-2",
        label: "PMS 2",
        product: "PMS",
        capacityLitres: 15000,
        lastClosingLitres: 8200,
        updatedAt: new Date(),
      },
      {
        id: "3",
        tankKey: "AGO-1",
        label: "AGO 1",
        product: "AGO",
        capacityLitres: 20000,
        lastClosingLitres: 3690,
        updatedAt: new Date(),
      },
    ]);
    assert.equal(sumStockByProduct(tanks, "PMS"), 23200);
    assert.equal(tanks[0]!.fillPct, 75);
  });

  it("averages only CLOSED report days (caller filters)", () => {
    const avg = averageDailySalesFromReports(
      [
        { meterSalesPmsLitres: 1000, meterSalesAgoLitres: 600 },
        { meterSalesPmsLitres: 800, meterSalesAgoLitres: 400 },
      ],
      "PMS"
    );
    assert.equal(avg, 900);
  });
});

describe("projections", () => {
  it("projects remaining days from avg rate", () => {
    const proj = projectPeriodSales({ actualToDate: 30000, avgDailySales: 1000, remainingDays: 10 });
    assert.equal(proj, 40000);
    assert.equal(classifyProjection({ target: 72000, projection: 40000 }), "below");
    assert.equal(classifyProjection({ target: 72000, projection: 72000 }), "on_track");
  });
});
