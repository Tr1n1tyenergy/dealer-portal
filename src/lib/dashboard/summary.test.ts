import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadHomeCounts, summaryLine } from "./summary";

describe("summaryLine", () => {
  it("lists every count with plurals", () => {
    assert.equal(
      summaryLine({ ordersToday: 7, paymentsToConfirm: 3, unreadMessages: 2 }),
      "Across the network today: 7 orders, 3 payments to confirm, 2 unread messages."
    );
    assert.equal(
      summaryLine({ ordersToday: 1, paymentsToConfirm: 1, unreadMessages: 1 }),
      "Across the network today: 1 order, 1 payment to confirm, 1 unread message."
    );
  });

  it("leaves out zeros and counts the person may not see", () => {
    assert.equal(summaryLine({ ordersToday: 7, paymentsToConfirm: 0, unreadMessages: null }), "Across the network today: 7 orders.");
  });

  it("says nothing is waiting when every visible count is zero", () => {
    assert.equal(summaryLine({ ordersToday: 0, paymentsToConfirm: 0, unreadMessages: 0 }), "Nothing waiting for you right now.");
  });

  it("never claims nothing is waiting when a count could not be loaded", () => {
    assert.equal(
      summaryLine({ ordersToday: 0, paymentsToConfirm: null, unreadMessages: 0, incomplete: true }),
      "Where do you want to work today?"
    );
  });

  it("falls back to a plain prompt when no count is visible", () => {
    assert.equal(summaryLine({ ordersToday: null, paymentsToConfirm: null, unreadMessages: null }), "Where do you want to work today?");
  });
});

describe("loadHomeCounts", () => {
  const fakeDb = (calls: string[], failPayments = false) => ({
    dealerOrder: { count: async () => (calls.push("orders"), 5) },
    paymentRecord: {
      count: async () => {
        calls.push("payments");
        if (failPayments) throw new Error("db hiccup");
        return 5;
      },
    },
  });
  const unread = async () => 2;
  const user = (role: string) => ({ id: "u1", accountType: "INTERNAL", role, permissions: null });

  it("loads all three for an admin", async () => {
    const calls: string[] = [];
    assert.deepEqual(await loadHomeCounts(user("SUPER_ADMIN"), { db: fakeDb(calls), unread }), {
      ordersToday: 5,
      paymentsToConfirm: 5,
      unreadMessages: 2,
      incomplete: false,
    });
  });

  it("loads nothing for a role without Retail, and never touches the database", async () => {
    const calls: string[] = [];
    let unreadCalled = false;
    const counts = await loadHomeCounts(user("STANDARD_USER"), {
      db: fakeDb(calls),
      unread: async () => ((unreadCalled = true), 2),
    });
    assert.deepEqual(counts, { ordersToday: null, paymentsToConfirm: null, unreadMessages: null, incomplete: false });
    assert.deepEqual(calls, []);
    assert.equal(unreadCalled, false);
  });

  it("drops only the count that fails", async () => {
    const counts = await loadHomeCounts(user("SUPER_ADMIN"), { db: fakeDb([], true), unread });
    assert.deepEqual(counts, { ordersToday: 5, paymentsToConfirm: null, unreadMessages: 2, incomplete: true });
  });
});
