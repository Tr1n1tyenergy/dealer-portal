import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateStaffReconciliation,
  resolvePeriodBounds,
  formatSignedLitres,
  formatVariancePct,
} from "./staff-reconciliation";

describe("aggregateStaffReconciliation", () => {
  it("uses first opening, last closing, and summed meter sales (Received = 0)", () => {
    const summary = aggregateStaffReconciliation([
      {
        reportingDate: new Date(Date.UTC(2026, 10, 10)),
        status: "CLOSED",
        meterSalesPmsLitres: 1000,
        meterSalesAgoLitres: 600,
        tankReadings: [
          { product: "PMS", openingLitres: 500, closingLitres: 1480 },
          { product: "AGO", openingLitres: 800, closingLitres: 1210 },
        ],
        pumpReadings: [],
      },
    ]);

    const pms = summary.rows.find((r) => r.product === "PMS")!;
    const ago = summary.rows.find((r) => r.product === "AGO")!;

    assert.equal(pms.opening, 500);
    assert.equal(pms.received, 0);
    assert.equal(pms.sales, 1000);
    assert.equal(pms.expectedClosing, -500); // 500 + 0 − 1000 until receipts exist
    assert.equal(pms.actualClosing, 1480);
    assert.equal(pms.variance, 1980); // 1480 − (−500)

    assert.equal(ago.opening, 800);
    assert.equal(ago.sales, 600);
    assert.equal(ago.actualClosing, 1210);
    assert.equal(summary.receiptsRecorded, false);
  });

  it("does not double-count openings across multi-day periods", () => {
    const summary = aggregateStaffReconciliation([
      {
        reportingDate: new Date(Date.UTC(2026, 10, 10)),
        status: "CLOSED",
        meterSalesPmsLitres: 100,
        meterSalesAgoLitres: 50,
        tankReadings: [
          { product: "PMS", openingLitres: 1000, closingLitres: 900 },
          { product: "AGO", openingLitres: 500, closingLitres: 450 },
        ],
        pumpReadings: [],
      },
      {
        reportingDate: new Date(Date.UTC(2026, 10, 11)),
        status: "CLOSED",
        meterSalesPmsLitres: 200,
        meterSalesAgoLitres: 80,
        tankReadings: [
          { product: "PMS", openingLitres: 900, closingLitres: 700 },
          { product: "AGO", openingLitres: 450, closingLitres: 370 },
        ],
        pumpReadings: [],
      },
    ]);

    const pms = summary.rows.find((r) => r.product === "PMS")!;
    assert.equal(pms.opening, 1000);
    assert.equal(pms.actualClosing, 700);
    assert.equal(pms.sales, 300);
    assert.equal(summary.totalSales, 300 + 50 + 80);
  });

  it("ignores DRAFT reports for stock figures", () => {
    const summary = aggregateStaffReconciliation([
      {
        reportingDate: new Date(Date.UTC(2026, 10, 10)),
        status: "DRAFT",
        meterSalesPmsLitres: 9999,
        meterSalesAgoLitres: 9999,
        tankReadings: [{ product: "PMS", openingLitres: 1, closingLitres: 1 }],
        pumpReadings: [],
      },
    ]);
    assert.equal(summary.totalSales, 0);
    assert.equal(summary.rows[0]!.opening, 0);
  });
});

describe("resolvePeriodBounds", () => {
  it("formats day / week / month labels", () => {
    const day = resolvePeriodBounds({
      period: "day",
      date: new Date(Date.UTC(2026, 10, 10)),
    });
    assert.equal(day.label, "10 Nov 2026");

    const week = resolvePeriodBounds({
      period: "week",
      date: new Date(Date.UTC(2026, 10, 10)), // Tuesday
    });
    assert.match(week.label, /^09 Nov 2026 – 15 Nov 2026$/);

    const month = resolvePeriodBounds({
      period: "month",
      date: new Date(Date.UTC(2026, 10, 10)),
    });
    assert.equal(month.label, "November 2026");
  });
});

describe("format helpers", () => {
  it("signs litres and percentages", () => {
    assert.equal(formatSignedLitres(-10), "−10");
    assert.equal(formatSignedLitres(10), "+10");
    assert.equal(formatVariancePct(-0.37037), "−0.37%");
    assert.equal(formatVariancePct(0.8333), "+0.83%");
  });
});
