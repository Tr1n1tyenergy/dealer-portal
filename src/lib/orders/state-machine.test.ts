import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTransition,
  canTransition,
  dealerStatusLabel,
  ignoreStaleTransition,
  StaleOrderTransition,
} from "./state-machine";

describe("order state machine", () => {
  it("rejects jumping from submitted to delivered", () => {
    assert.equal(canTransition("SUBMITTED", "DELIVERED"), false);
    assert.throws(() => assertTransition("SUBMITTED", "DELIVERED"));
  });

  it("allows the commercial path through payment confirmation", () => {
    assert.equal(canTransition("SUBMITTED", "ODOO_SYNC_PENDING"), true);
    assert.equal(canTransition("ODOO_SYNC_PENDING", "QUOTATION_READY"), true);
    assert.equal(canTransition("QUOTATION_READY", "PFI_PENDING"), true);
    assert.equal(canTransition("PFI_ISSUED", "AWAITING_PAYMENT"), true);
    assert.equal(canTransition("PAYMENT_CONFIRMED", "RELEASED_TO_DEPOT"), true);
  });

  it("blocks dispatch before loading is complete", () => {
    assert.equal(canTransition("LOADING", "DISPATCHED"), false);
    assert.equal(canTransition("LOADED", "DISPATCHED"), true);
  });

  it("blocks depot release before payment is confirmed", () => {
    assert.equal(canTransition("AWAITING_PAYMENT", "RELEASED_TO_DEPOT"), false);
    assert.equal(canTransition("PAYMENT_CONFIRMED", "RELEASED_TO_DEPOT"), true);
  });

  it("hides internal sync statuses from dealers", () => {
    assert.equal(dealerStatusLabel("SUBMITTED"), "Order Submitted");
    assert.equal(dealerStatusLabel("ODOO_SYNC_PENDING"), "Quotation Processing");
    assert.equal(dealerStatusLabel("ODOO_SYNC_FAILED"), "Quotation Processing");
  });
});

describe("ignoreStaleTransition", () => {
  it("treats a click that lost the race as already done", async () => {
    const result = await ignoreStaleTransition(async () => {
      throw new StaleOrderTransition("PAYMENT_VERIFICATION", "PAYMENT_CONFIRMED");
    });
    assert.equal(result, null);
  });

  it("returns the result of a transition that succeeds", async () => {
    assert.equal(await ignoreStaleTransition(async () => "moved"), "moved");
  });

  it("still surfaces every other error", async () => {
    await assert.rejects(
      ignoreStaleTransition(async () => assertTransition("SUBMITTED", "DELIVERED")),
      { name: "InvalidOrderTransition" }
    );
  });
});
