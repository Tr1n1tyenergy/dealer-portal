import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateStaffMonetary,
  buildTargetVsActual,
  monetaryTargetKes,
  paymentMethodSlices,
} from "./staff-monetary-sales";

const base = {
  reportingDate: new Date(Date.UTC(2026, 10, 10)),
  status: "CLOSED" as const,
  monetaryDiscrepancyReason: null,
};

describe("aggregateStaffMonetary", () => {
  it("computes PMS/AGO revenue, collections, and zero variance", () => {
    const summary = aggregateStaffMonetary([
      {
        ...base,
        meterSalesPmsLitres: 1000,
        meterSalesAgoLitres: 600,
        sellingPricePmsKes: 248,
        sellingPriceAgoKes: 233,
        expectedPmsKes: 248_000,
        expectedAgoKes: 139_800,
        expectedRevenueKes: 387_800,
        cashCollectionsKes: 120_000,
        mpesaCollectionsKes: 200_000,
        cardCollectionsKes: 67_800,
        collectionsKes: 387_800,
        monetaryDifferenceKes: 0,
      },
    ]);

    assert.equal(summary.pms.revenueKes, 248_000);
    assert.equal(summary.ago.revenueKes, 139_800);
    assert.equal(summary.totalRevenueKes, 387_800);
    assert.equal(summary.totalCollectionsKes, 387_800);
    assert.equal(summary.monetaryVarianceKes, 0);
    assert.equal(summary.pms.unitPrice, 248);
  });

  it("flags multi-price periods and uses weighted average", () => {
    const summary = aggregateStaffMonetary([
      {
        ...base,
        reportingDate: new Date(Date.UTC(2026, 10, 10)),
        meterSalesPmsLitres: 1000,
        meterSalesAgoLitres: 0,
        sellingPricePmsKes: 248,
        sellingPriceAgoKes: 233,
        expectedPmsKes: 248_000,
        expectedAgoKes: 0,
        expectedRevenueKes: 248_000,
        cashCollectionsKes: 248_000,
        mpesaCollectionsKes: 0,
        cardCollectionsKes: 0,
        collectionsKes: 248_000,
        monetaryDifferenceKes: 0,
      },
      {
        ...base,
        reportingDate: new Date(Date.UTC(2026, 10, 15)),
        meterSalesPmsLitres: 1000,
        meterSalesAgoLitres: 0,
        sellingPricePmsKes: 251,
        sellingPriceAgoKes: 233,
        expectedPmsKes: 251_000,
        expectedAgoKes: 0,
        expectedRevenueKes: 251_000,
        cashCollectionsKes: 251_000,
        mpesaCollectionsKes: 0,
        cardCollectionsKes: 0,
        collectionsKes: 251_000,
        monetaryDifferenceKes: 0,
      },
    ]);

    assert.equal(summary.pms.multiPrice, true);
    assert.equal(summary.pms.unitPrice, null);
    assert.equal(summary.pms.revenueKes, 499_000);
    assert.ok(summary.pms.weightedAveragePrice != null);
    assert.equal(Math.round(summary.pms.weightedAveragePrice! * 100) / 100, 249.5);
  });

  it("ignores DRAFT reports", () => {
    const summary = aggregateStaffMonetary([
      {
        ...base,
        status: "DRAFT",
        meterSalesPmsLitres: 9999,
        meterSalesAgoLitres: 9999,
        sellingPricePmsKes: 248,
        sellingPriceAgoKes: 233,
        expectedPmsKes: 1,
        expectedAgoKes: 1,
        expectedRevenueKes: 2,
        cashCollectionsKes: 2,
        mpesaCollectionsKes: 0,
        cardCollectionsKes: 0,
        collectionsKes: 2,
        monetaryDifferenceKes: 0,
      },
    ]);
    assert.equal(summary.totalRevenueKes, 0);
    assert.equal(summary.reportsIncluded, 0);
  });
});

describe("targets & payment slices", () => {
  it("converts volume target × price to monetary target", () => {
    assert.equal(monetaryTargetKes({ volumeTarget: 1500, priceKesPerLitre: 248 }), 372_000);
  });

  it("builds target vs actual achievement", () => {
    const rows = buildTargetVsActual({
      pmsActual: 248_000,
      agoActual: 139_800,
      pmsTarget: 372_000,
      agoTarget: 160_000,
    });
    const pms = rows.find((r) => r.product === "PMS")!;
    assert.equal(pms.achievementPct?.toFixed(2), "66.67");
  });

  it("payment percentages sum near 100", () => {
    const summary = aggregateStaffMonetary([
      {
        ...base,
        meterSalesPmsLitres: 1000,
        meterSalesAgoLitres: 600,
        sellingPricePmsKes: 248,
        sellingPriceAgoKes: 233,
        expectedPmsKes: 248_000,
        expectedAgoKes: 139_800,
        expectedRevenueKes: 387_800,
        cashCollectionsKes: 120_000,
        mpesaCollectionsKes: 200_000,
        cardCollectionsKes: 67_800,
        collectionsKes: 387_800,
        monetaryDifferenceKes: 0,
      },
    ]);
    const slices = paymentMethodSlices(summary);
    const pct = slices.reduce((s, x) => s + x.pct, 0);
    assert.ok(Math.abs(pct - 100) < 0.05);
  });
});
