import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DealerOrderStatus } from "@prisma/client";
import {
  STUCK_LIMIT_HOURS,
  eventText,
  formatWait,
  stageCounts,
  stuckOrders,
  timeAgo,
  type InsightOrder,
} from "./live";

const HOUR = 3_600_000;
const now = new Date("2026-11-17T12:00:00Z");

let n = 0;
function order(status: DealerOrderStatus, over: Partial<InsightOrder> = {}): InsightOrder {
  n += 1;
  return {
    id: `o${n}`,
    reference: `DO-2026-${String(n).padStart(6, "0")}`,
    status,
    createdAt: new Date(now.getTime() - 100 * HOUR),
    updatedAt: now,
    dealerName: "Pery Growers",
    stationName: "Kitale",
    stationCode: "kitale",
    amountDue: null,
    lines: [],
    ...over,
  };
}

describe("stageCounts", () => {
  it("counts open orders in the six open stages and marks the busiest", () => {
    const counts = { QUOTATION_READY: 3, AWAITING_PAYMENT: 14, PAYMENT_SUBMITTED: 2, PAYMENT_CONFIRMED: 1, LOADING: 2, IN_TRANSIT: 1 } as const;
    const orders = Object.entries(counts).flatMap(([s, c]) => Array.from({ length: c }, () => order(s as DealerOrderStatus)));
    orders.push(order("DELIVERED"), order("CANCELLED"));
    const tiles = stageCounts(orders);
    assert.deepEqual(tiles.map((t) => t.key), ["quotation", "awaiting-payment", "checking-payment", "payment-confirmed", "depot", "transit"]);
    assert.deepEqual(tiles.map((t) => t.count), [3, 14, 2, 1, 2, 1]);
    assert.deepEqual(tiles.filter((t) => t.busiest).map((t) => t.key), ["awaiting-payment"]);
  });

  it("marks no tile busiest when nothing is open", () => {
    assert.equal(stageCounts([order("DELIVERED")]).some((t) => t.busiest), false);
  });
});

describe("stuckOrders", () => {
  it("is stuck only once the stage limit has passed", () => {
    for (const [status, hours] of Object.entries(STUCK_LIMIT_HOURS)) {
      const atLimit = order(status as DealerOrderStatus, { updatedAt: new Date(now.getTime() - hours! * HOUR) });
      const over = order(status as DealerOrderStatus, { updatedAt: new Date(now.getTime() - hours! * HOUR - 60_000) });
      const ids = stuckOrders([atLimit, over], [], now).map((s) => s.id);
      assert.deepEqual(ids, [over.id], status);
    }
  });

  it("never marks statuses without a limit", () => {
    assert.deepEqual(stuckOrders([order("DELIVERED", { updatedAt: new Date(0) }), order("CANCELLED", { updatedAt: new Date(0) })], [], now), []);
  });

  it("measures from the latest history row for the current status, else updatedAt", () => {
    const o = order("PAYMENT_CONFIRMED", { updatedAt: new Date(now.getTime() - 100 * HOUR) });
    const history = [
      { orderId: o.id, toStatus: "PAYMENT_CONFIRMED", createdAt: new Date(now.getTime() - 50 * HOUR) },
      { orderId: o.id, toStatus: "PAYMENT_CONFIRMED", createdAt: new Date(now.getTime() - 3 * HOUR) },
      { orderId: o.id, toStatus: "AWAITING_PAYMENT", createdAt: new Date(now.getTime() - 1 * HOUR) },
    ];
    assert.deepEqual(stuckOrders([o], history, now), []);
    const [s] = stuckOrders([o], [], now);
    assert.equal(s.waitedMs, 100 * HOUR);
    assert.equal(s.limitHours, 8);
    assert.equal(s.stageLabel, "Payment Confirmed");
  });

  it("orders by how far over the limit they are", () => {
    const a = order("PAYMENT_CONFIRMED", { updatedAt: new Date(now.getTime() - 10 * HOUR) }); // 2 h over
    const b = order("AWAITING_PAYMENT", { updatedAt: new Date(now.getTime() - 122 * HOUR) }); // 74 h over
    const c = order("PAYMENT_SUBMITTED", { updatedAt: new Date(now.getTime() - 31 * HOUR) }); // 7 h over
    assert.deepEqual(stuckOrders([a, b, c], [], now).map((s) => s.id), [b.id, c.id, a.id]);
  });
});

describe("eventText", () => {
  const e = { reference: "DO-1", dealerName: "Beekey", stationName: "Magumu", depotName: "Lake Oil Nairobi" };
  it("words each status for people", () => {
    assert.equal(eventText({ ...e, toStatus: "SUBMITTED" }), "Beekey placed DO-1");
    assert.equal(eventText({ ...e, toStatus: "PFI_ISSUED" }), "PFI issued for DO-1");
    assert.equal(eventText({ ...e, toStatus: "PAYMENT_SUBMITTED" }), "Beekey submitted payment for DO-1");
    assert.equal(eventText({ ...e, toStatus: "PAYMENT_CONFIRMED" }), "Payment confirmed for DO-1");
    assert.equal(eventText({ ...e, toStatus: "RELEASED_TO_DEPOT" }), "DO-1 released to Lake Oil Nairobi");
    assert.equal(eventText({ ...e, toStatus: "RELEASED_TO_DEPOT", depotName: null }), "DO-1 released to the depot");
    assert.equal(eventText({ ...e, toStatus: "DISPATCHED" }), "DO-1 left the depot");
    assert.equal(eventText({ ...e, toStatus: "DELIVERED" }), "DO-1 delivered to Magumu");
    assert.equal(eventText({ ...e, toStatus: "PAYMENT_EXCEPTION" }), "DO-1: Payment exception");
  });
});

describe("formatWait / timeAgo", () => {
  it("formats waits", () => {
    assert.equal(formatWait(12_000_000), "3 h 20 m");
    assert.equal(formatWait(440_000_000), "5 d 2 h");
    assert.equal(formatWait(45 * 60_000), "45 m");
  });
  it("formats how long ago", () => {
    const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now);
    assert.equal(ago(59_000), "just now");
    assert.equal(ago(60_000), "1 min ago");
    assert.equal(ago(90 * 60_000), "1 h ago");
    assert.equal(ago(49 * HOUR), "2 d ago");
  });
});
