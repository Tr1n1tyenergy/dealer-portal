import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentTasks, type WaitingPaymentOrder } from "./staff-home";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 19, 9, minutes));
const order = (n: number, payments: Partial<WaitingPaymentOrder["payments"][number]>[]): WaitingPaymentOrder => ({
  id: `o${n}`,
  reference: `DO-2026-00000${n}`,
  dealerName: `Dealer ${n} Ltd`,
  payments: payments.map((p) => ({
    amount: "100.00",
    method: "MANUAL",
    bankAccountNumber: "1289725640",
    odooState: null,
    odooError: null,
    createdAt: at(0),
    ...p,
  })),
});

describe("paymentTasks", () => {
  it("lists one row per order, newest waiting payment first, linking to its payment review page", () => {
    const tasks = paymentTasks([order(1, [{ createdAt: at(1) }]), order(2, [{ createdAt: at(5) }])]);
    assert.deepEqual(tasks.map((t) => t.key), ["pay-o2", "pay-o1"]);
    assert.equal(tasks[0].title, "DO-2026-000002 · Dealer 2 Ltd");
    assert.equal(tasks[0].actionHref, "/intelligence/retail/orders/o2/payment");
    assert.equal(tasks[0].actionLabel, "Review →");
    assert.equal(tasks[0].badge, "1 waiting");
  });

  it("describes each payment and says when a draft is in Odoo", () => {
    const [task] = paymentTasks([
      order(1, [
        { amount: "250000.00", method: "MPESA_CODE", bankAccountNumber: null, odooState: "posted" },
        { amount: "600000.00", odooState: "draft" },
      ]),
    ]);
    assert.equal(task.description, "KES 250,000 by M-PESA · KES 600,000 manual (KCB) · Draft in Odoo");
    assert.equal(task.badge, "2 waiting");
    assert.equal(task.badgeTone, "pending");
  });

  it("flags an Odoo error on the row", () => {
    const [task] = paymentTasks([order(1, [{ amount: "6618499.98", bankAccountNumber: "1080281394514", odooError: "Odoo could not be reached." }])]);
    assert.equal(task.badge, "Odoo error");
    assert.equal(task.badgeTone, "overdue");
    assert.equal(task.description, "KES 6,618,499.98 manual (Equity) · Not in Odoo yet");
  });

  it("shows at most five orders", () => {
    assert.equal(paymentTasks(Array.from({ length: 7 }, (_, i) => order(i + 1, [{}]))).length, 5);
  });
});
