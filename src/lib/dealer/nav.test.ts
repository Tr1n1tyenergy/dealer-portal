import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeDealerNav, activePrimaryNav, DEALER_PRIMARY_NAV } from "./nav";

describe("activeDealerNav", () => {
  const cases: [string, string | null, string | null][] = [
    ["/dealer/dashboard", null, "dashboard"],
    ["/dealer/orders/new", null, "place-order"],
    ["/dealer/orders", null, "orders"],
    ["/dealer/orders", "foo", "orders"],
    ["/dealer/orders/abc123", null, "orders"],
    ["/dealer/orders/abc123", "payment", "orders"],
    ["/dealer/orders", "documents", "orders"],
    ["/dealer/orders", "payment", "payments"],
    ["/dealer/orders", "deliveries", "deliveries"],
    ["/dealer/messaging", null, "messaging"],
    ["/dealer/support", null, "support"],
    ["/dealer/support/tickets/abc", null, "support"],
    ["/dealer/stock-reporting", null, "stock-reporting"],
    ["/dealer/stock-reporting/history", null, "stock-reporting"],
    ["/dealer/elsewhere", null, null],
  ];

  for (const [pathname, view, expected] of cases) {
    it(`${pathname}${view ? `?view=${view}` : ""} → ${expected}`, () => {
      assert.equal(activeDealerNav(pathname, view), expected);
    });
  }
});

describe("activePrimaryNav", () => {
  it("maps place-order, payment, documents, and deliveries to the Orders tab", () => {
    assert.equal(activePrimaryNav("/dealer/orders/new", null), "orders");
    assert.equal(activePrimaryNav("/dealer/orders", "payment"), "orders");
    assert.equal(activePrimaryNav("/dealer/orders", "documents"), "orders");
    assert.equal(activePrimaryNav("/dealer/orders", "deliveries"), "orders");
  });

  it("keeps Messages, Support, and Stock Sale Reporting distinct", () => {
    assert.equal(activePrimaryNav("/dealer/messaging", null), "messaging");
    assert.equal(activePrimaryNav("/dealer/support", null), "support");
    assert.equal(activePrimaryNav("/dealer/dashboard", null), "dashboard");
    assert.equal(activePrimaryNav("/dealer/stock-reporting", null), "stock-reporting");
  });

  it("does not include a top-level PFIs nav item", () => {
    assert.equal(
      DEALER_PRIMARY_NAV.some((item) => String(item.key) === "documents" || String(item.label) === "PFIs"),
      false,
    );
  });
});
