import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DealerOrderStatus } from "@prisma/client";
import { cycleTimes, monthFigures, monthlyLitres } from "./figures";
import type { InsightHistory, InsightOrder } from "./live";

const HOUR = 3_600_000;
const now = new Date("2026-11-17T12:00:00Z");
const lastMonth = new Date("2026-10-10T09:00:00Z");

let n = 0;
function order(
  createdAt: Date,
  litres: { pms?: number; ago?: number } = {},
  over: Partial<InsightOrder> = {},
): InsightOrder {
  n += 1;
  const lines = [
    ...(litres.pms ? [{ product: "PMS", quantityLitres: litres.pms }] : []),
    ...(litres.ago ? [{ product: "AGO", quantityLitres: litres.ago }] : []),
  ];
  return {
    id: `o${n}`,
    reference: `DO-${n}`,
    status: "AWAITING_PAYMENT" as DealerOrderStatus,
    createdAt,
    updatedAt: createdAt,
    dealerName: "Pery Growers",
    stationName: "Kitale",
    stationCode: "kitale",
    amountDue: null,
    lines,
    ...over,
  };
}

describe("monthFigures", () => {
  it("adds up this month against last month, skipping drafts, cancelled and rejected", () => {
    const orders = [
      order(now, { pms: 10_000, ago: 5_000 }, { amountDue: "1066500.00" }),
      order(now, { pms: 2_000 }, { dealerName: "Beekey" }),
      order(now, { pms: 9_999 }, { status: "CANCELLED", amountDue: "5.00" }),
      order(now, { pms: 9_999 }, { status: "DRAFT" }),
      order(now, { pms: 9_999 }, { status: "REJECTED" }),
      order(lastMonth, { ago: 34_000 }, { amountDue: "500000.00" }),
    ];
    const f = monthFigures(orders, now);
    assert.deepEqual(f.litres, { now: 17_000, prev: 34_000, change: -50 });
    assert.deepEqual(f.value, { now: 1_066_500, prev: 500_000, change: 113.3 });
    assert.deepEqual(f.orders, { now: 2, prev: 1, change: 100 });
    assert.deepEqual(f.activeDealers, { now: 2, prev: 1, change: 100 });
  });

  it("reports no percentage when last month was zero, and zeros for an empty month", () => {
    const f = monthFigures([order(now, { pms: 1_000 })], now);
    assert.equal(f.litres.change, null);
    const empty = monthFigures([], now);
    assert.deepEqual(empty.orders, { now: 0, prev: 0, change: null });
    assert.deepEqual(empty.value, { now: 0, prev: 0, change: null });
  });

  it("puts an order at 00:30 on the 1st (Nairobi) in the new month", () => {
    const f = monthFigures([order(new Date("2026-10-31T21:30:00Z"), { pms: 1_000 })], now);
    assert.equal(f.orders.now, 1);
  });
});

describe("monthlyLitres", () => {
  it("returns 12 Nairobi months ending this month, PMS and AGO apart", () => {
    const series = monthlyLitres([order(now, { pms: 10, ago: 5 }), order(lastMonth, { ago: 7 }), order(now, { pms: 99 }, { status: "CANCELLED" })], now);
    assert.equal(series.length, 12);
    assert.deepEqual(series.at(-1), { key: "2026-11", label: "Nov", pms: 10, ago: 5 });
    assert.deepEqual(series.at(-2), { key: "2026-10", label: "Oct", pms: 0, ago: 7 });
    assert.equal(series[0].key, "2025-12");
  });
});

describe("cycleTimes", () => {
  const h = (orderId: string, toStatus: string, hoursAgo: number): InsightHistory => ({
    orderId,
    toStatus,
    createdAt: new Date(now.getTime() - hoursAgo * HOUR),
  });

  it("takes the median of steps finished this month and marks the slowest", () => {
    const history = [
      h("a", "SUBMITTED", 10), h("a", "PFI_ISSUED", 9),          // 1 h
      h("b", "SUBMITTED", 20), h("b", "PFI_ISSUED", 17),         // 3 h
      h("c", "SUBMITTED", 30), h("c", "PFI_ISSUED", 28),         // 2 h
      h("a", "PAYMENT_CONFIRMED", 3),                            // PFI→paid 6 h
      h("d", "PFI_ISSUED", 40), h("d", "PAYMENT_CONFIRMED", 20), // 20 h
    ];
    const steps = cycleTimes(history, now);
    assert.deepEqual(steps.map((s) => s.label), [
      "Order → PFI issued",
      "PFI → payment confirmed",
      "Paid → released to depot",
      "Released → delivered",
    ]);
    assert.equal(steps[0].medianMs, 2 * HOUR);
    assert.equal(steps[1].medianMs, 13 * HOUR);
    assert.equal(steps[2].medianMs, null);
    assert.deepEqual(steps.map((s) => s.slowest), [false, true, false, false]);
  });

  it("uses the mean of the middle two for an even count, and skips orders missing the start", () => {
    const history = [
      h("a", "SUBMITTED", 5), h("a", "PFI_ISSUED", 4),
      h("b", "SUBMITTED", 6), h("b", "PFI_ISSUED", 4),
      h("c", "SUBMITTED", 7), h("c", "PFI_ISSUED", 4),
      h("d", "SUBMITTED", 8), h("d", "PFI_ISSUED", 4),
      h("e", "PFI_ISSUED", 4),
    ];
    assert.equal(cycleTimes(history, now)[0].medianMs, 2.5 * HOUR);
  });

  it("ignores steps that finished before this month", () => {
    const old = [
      { orderId: "x", toStatus: "SUBMITTED", createdAt: new Date("2026-10-20T00:00:00Z") },
      { orderId: "x", toStatus: "PFI_ISSUED", createdAt: new Date("2026-10-20T05:00:00Z") },
    ];
    assert.equal(cycleTimes(old, now)[0].medianMs, null);
    assert.equal(cycleTimes(old, now).some((s) => s.slowest), false);
  });
});
