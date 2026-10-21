import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeDealerNav } from "./nav";

describe("activeDealerNav", () => {
  const cases: [string, string | null, string | null][] = [
    ["/dealer/dashboard", null, "dashboard"],
    ["/dealer/orders/new", null, "place-order"],
    ["/dealer/orders", null, "orders"],
    ["/dealer/orders", "foo", "orders"],
    ["/dealer/orders/abc123", null, "orders"],
    ["/dealer/orders/abc123", "payment", "orders"],
    ["/dealer/orders", "documents", "documents"],
    ["/dealer/orders", "payment", "payments"],
    ["/dealer/orders", "deliveries", "deliveries"],
    ["/dealer/messaging", null, "messaging"],
    ["/dealer/elsewhere", null, null],
  ];

  for (const [pathname, view, expected] of cases) {
    it(`${pathname}${view ? `?view=${view}` : ""} → ${expected}`, () => {
      assert.equal(activeDealerNav(pathname, view), expected);
    });
  }
});
