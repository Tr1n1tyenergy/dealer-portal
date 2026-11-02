import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DealerOrderStatus } from "@prisma/client";
import { ORDER_TRANSITIONS } from "@/lib/orders/state-machine";
import { statusTone, type Tone } from "./status-tone";

const expected: Record<Tone, DealerOrderStatus[]> = {
  dealer: ["PFI_ISSUED", "AWAITING_PAYMENT", "REQUIRES_AMENDMENT"],
  trinity: ["SUBMITTED", "ODOO_SYNC_PENDING", "QUOTATION_CREATING", "QUOTATION_READY", "PFI_PENDING", "PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION", "PAYMENT_CONFIRMED"],
  moving: ["RELEASED_TO_DEPOT", "LOADING", "LOADED", "DISPATCHED", "IN_TRANSIT"],
  done: ["DELIVERED", "CLOSED"],
  problem: ["ODOO_SYNC_FAILED", "PAYMENT_EXCEPTION", "STOCK_EXCEPTION", "DELIVERY_EXCEPTION", "REJECTED"],
  muted: ["CANCELLED", "DRAFT"],
};

describe("status chip colours", () => {
  for (const [tone, statuses] of Object.entries(expected)) {
    it(`${tone}: ${statuses.join(", ")}`, () => {
      for (const s of statuses) assert.equal(statusTone(s), tone, s);
    });
  }
  it("every order status has exactly one colour", () => {
    const listed = Object.values(expected).flat();
    for (const s of Object.keys(ORDER_TRANSITIONS) as DealerOrderStatus[]) {
      assert.equal(listed.filter((x) => x === s).length, 1, s);
      assert.ok(statusTone(s), s);
    }
  });
});
