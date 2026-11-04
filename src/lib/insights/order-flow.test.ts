import { test } from "node:test";
import assert from "node:assert/strict";
import { waitedOn, cycleMedians, eventLine, formatWaited, stageCounts, STAGE_TILES, stuckOrders } from "./order-flow";

const H = 3600e3;

test("stage tiles: every open status lands in exactly one tile; finished ones in none", () => {
  const rows = ["SUBMITTED", "ODOO_SYNC_PENDING", "QUOTATION_READY", "ODOO_SYNC_FAILED", "PFI_ISSUED", "AWAITING_PAYMENT", "AWAITING_PAYMENT",
    "PAYMENT_VERIFICATION", "PAYMENT_CONFIRMED", "LOADING", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((status) => ({ status }));
  const counts = Object.fromEntries(stageCounts(rows as never).map((t) => [t.key, t.count]));
  assert.deepEqual(counts, { submitted: 2, quotation: 2, pfi: 1, "awaiting-payment": 2, checking: 1, paid: 1, "at-depot": 1, "on-the-road": 1 });
  assert.equal(STAGE_TILES.length, 8);
  assert.equal(stageCounts([]).find((t) => t.key === "paid")?.tab, "paid");
});

test("stuck: awaiting payment is stuck just after 48 h, not just before", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * H);
  const base = { dealer: "Pery Growers", updatedAt: now };
  const rows = [
    { ...base, id: "a", reference: "DO-1", status: "AWAITING_PAYMENT" as const, enteredAt: at(47 + 59 / 60) },
    { ...base, id: "b", reference: "DO-2", status: "AWAITING_PAYMENT" as const, enteredAt: at(48 + 1 / 60) },
  ];
  assert.deepEqual(stuckOrders(rows, now).map((r) => r.id), ["b"]);
});

test("stuck: no history row falls back to updatedAt; most over the limit first", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const rows = [
    { id: "odoo", reference: "DO-3", status: "ODOO_SYNC_FAILED" as const, dealer: "Kenbi", enteredAt: null, updatedAt: new Date(now.getTime() - 26 * H) },
    { id: "pay", reference: "DO-4", status: "PAYMENT_VERIFICATION" as const, dealer: "Sobea", enteredAt: new Date(now.getTime() - 76 * H), updatedAt: now },
    { id: "done", reference: "DO-5", status: "DELIVERED" as const, dealer: "Sobea", enteredAt: new Date(now.getTime() - 900 * H), updatedAt: now },
  ];
  const r = stuckOrders(rows, now);
  assert.deepEqual(r.map((x) => x.id), ["pay", "odoo"]);
  assert.equal(r[1].waitedMs, 26 * H);
  assert.ok(Number.isFinite(r[0].overBy));
});

test("formatWaited", () => {
  assert.equal(formatWaited(26 * H), "26 h");
  assert.equal(formatWaited(76 * H), "3 d 4 h");
  assert.equal(formatWaited(40 * 60e3), "40 min");
  assert.equal(formatWaited(0), "0 min");
});

test("event wording for every status the feed shows", () => {
  const e = { reference: "DO-2026-000014", dealer: "Pery Growers", depot: "Nakuru" };
  const cases: [string, string][] = [
    ["SUBMITTED", "Pery Growers placed DO-2026-000014"],
    ["PFI_ISSUED", "PFI issued for DO-2026-000014 · Pery Growers"],
    ["AWAITING_PAYMENT", "PFI issued for DO-2026-000014 · Pery Growers"],
    ["PAYMENT_SUBMITTED", "Pery Growers submitted payment for DO-2026-000014"],
    ["PAYMENT_CONFIRMED", "Payment confirmed for DO-2026-000014"],
    ["PAYMENT_EXCEPTION", "Payment flagged for DO-2026-000014"],
    ["RELEASED_TO_DEPOT", "DO-2026-000014 released to Nakuru"],
    ["LOADING", "Nakuru started loading DO-2026-000014"],
    ["DISPATCHED", "DO-2026-000014 left Nakuru"],
    ["DELIVERED", "DO-2026-000014 delivered to Pery Growers"],
    ["QUOTATION_READY", "DO-2026-000014: Quotation ready"],
  ];
  for (const [toStatus, line] of cases) assert.equal(eventLine({ ...e, toStatus }), line, toStatus);
  assert.equal(eventLine({ ...e, depot: null, toStatus: "LOADING" }), "The depot started loading DO-2026-000014");
});

test("median time per step; a step with no data is null", () => {
  const t = (iso: string) => new Date(iso);
  const rows = [2, 4, 6].map((h) => ({
    createdAt: t("2026-11-01T08:00:00Z"),
    quotedAt: new Date(t("2026-11-01T08:00:00Z").getTime() + h * H),
    paidAt: null,
    releasedAt: null,
    deliveredAt: null,
  }));
  const m = Object.fromEntries(cycleMedians(rows).map((s) => [s.step, s.medianMs]));
  assert.equal(m["Order → PFI"], 4 * H);
  assert.equal(m["PFI → paid"], null);
  assert.equal(cycleMedians([]).every((s) => s.medianMs === null), true);
});

test("waitedOn: time in the stage, over only past that stage's limit", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const at = (h: number) => new Date(now.getTime() - h * 3600e3);
  assert.deepEqual(waitedOn({ status: "PAYMENT_CONFIRMED", enteredAt: at(8), updatedAt: at(1) }, now), { waitedMs: 8 * 3600e3, over: false });
  assert.deepEqual(waitedOn({ status: "PAYMENT_CONFIRMED", enteredAt: null, updatedAt: at(9) }, now), { waitedMs: 9 * 3600e3, over: true });
  assert.equal(waitedOn({ status: "DELIVERED", enteredAt: at(900), updatedAt: at(900) }, now).over, false);
});
