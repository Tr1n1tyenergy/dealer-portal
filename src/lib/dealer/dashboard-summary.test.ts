import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dashboardSummary, monthlyLitres, type SummaryOrder } from "./dashboard-summary";

const now = new Date("2026-11-03T09:00:00Z"); // 12:00 in Nairobi
const order = (id: string, status: SummaryOrder["status"], litres: { pms?: number; ago?: number } = {}, createdAt = "2026-11-02T08:00:00Z"): SummaryOrder => ({
  id,
  status,
  createdAt: new Date(createdAt),
  lines: [
    ...(litres.pms ? [{ product: "PMS" as const, quantityLitres: litres.pms }] : []),
    ...(litres.ago ? [{ product: "AGO" as const, quantityLitres: litres.ago }] : []),
  ],
});

describe("dealer dashboard summary", () => {
  it("one PFI to pay and one delivery on the road", () => {
    const s = dashboardSummary([order("a", "AWAITING_PAYMENT"), order("b", "IN_TRANSIT")], now);
    assert.equal(s.needsYou, "One PFI is waiting for payment and one delivery is on the road.");
    assert.deepEqual(s.secondAction, { label: "Pay PFI", href: "/dealer/orders/a" });
  });

  it("counts several and uses numbers above one", () => {
    const s = dashboardSummary([order("a", "PFI_ISSUED"), order("b", "AWAITING_PAYMENT"), order("c", "PAYMENT_EXCEPTION")], now);
    assert.equal(s.needsYou, "3 PFIs are waiting for payment.");
  });

  it("no PFI to pay but a truck on the way: Track delivery", () => {
    const s = dashboardSummary([order("x", "LOADING"), order("y", "DISPATCHED")], now);
    assert.equal(s.needsYou, "2 deliveries are on the road.");
    assert.deepEqual(s.secondAction, { label: "Track delivery", href: "/dealer/orders/x" });
  });

  it("nothing waiting: a calm sentence and no second button", () => {
    const s = dashboardSummary([order("d", "DELIVERED"), order("e", "PAYMENT_VERIFICATION")], now);
    assert.equal(s.needsYou, "Nothing needs you right now.");
    assert.equal(s.secondAction, null);
  });

  it("this month: litres, PMS/AGO split and order count, Nairobi month, cancelled left out", () => {
    const s = dashboardSummary(
      [
        order("1", "DELIVERED", { pms: 3000, ago: 2000 }),
        order("2", "AWAITING_PAYMENT", { pms: 5000 }),
        order("3", "CANCELLED", { pms: 9000 }),
        order("4", "DELIVERED", { ago: 7000 }, "2026-10-31T20:30:00Z"), // 31 Oct 23:30 Nairobi: last month
        order("5", "DELIVERED", { ago: 1000 }, "2026-10-31T21:30:00Z"), // 1 Nov 00:30 Nairobi: this month
      ],
      now,
    );
    assert.deepEqual(s.month, { litres: 11000, pmsLitres: 8000, agoLitres: 3000, orders: 3 });
  });
});

describe("monthlyLitres", () => {
  const now = new Date("2026-11-20T09:00:00Z");
  const o = (id: string, status: SummaryOrder["status"], at: string, pms: number, ago: number): SummaryOrder => ({
    id,
    status,
    createdAt: new Date(at),
    lines: [
      ...(pms ? [{ product: "PMS", quantityLitres: pms }] : []),
      ...(ago ? [{ product: "AGO", quantityLitres: ago }] : []),
    ],
  });

  it("six Nairobi months, oldest first, cancelled orders left out", () => {
    const rows = monthlyLitres(
      [
        o("1", "DELIVERED", "2026-11-02T08:00:00Z", 5000, 0),
        o("2", "AWAITING_PAYMENT", "2026-11-05T08:00:00Z", 3000, 2000),
        o("3", "CANCELLED", "2026-11-06T08:00:00Z", 9000, 9000),
        o("4", "DELIVERED", "2026-09-30T22:30:00Z", 1000, 0), // 1 Oct in Nairobi
        o("5", "DELIVERED", "2026-04-10T08:00:00Z", 7000, 0), // older than six months
      ],
      now,
    );
    assert.deepEqual(rows.map((r) => r.label), ["Jun", "Jul", "Aug", "Sept", "Oct", "Nov"]);
    assert.deepEqual(rows[5], { label: "Nov", pms: 8000, ago: 2000 });
    assert.deepEqual(rows[4], { label: "Oct", pms: 1000, ago: 0 });
    assert.deepEqual(rows[3], { label: "Sept", pms: 0, ago: 0 });
  });
});
