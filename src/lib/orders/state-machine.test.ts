import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTransition,
  canTransition,
  dealerStatusLabel,
  dealerTrackerSteps,
  DEALER_TRACKER_STEPS,
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

describe("dealerTrackerSteps", () => {
  const states = (status: Parameters<typeof dealerTrackerSteps>[0]) =>
    dealerTrackerSteps(status).steps.map((step) => step.state);
  const noteOf = (status: Parameters<typeof dealerTrackerSteps>[0]) =>
    dealerTrackerSteps(status).steps.find((step) => step.state === "active" || step.state === "attention")
      ?.note ?? null;

  it("has the seven dealer steps in order", () => {
    assert.deepEqual(
      DEALER_TRACKER_STEPS.map((step) => step.label),
      ["Order Submitted", "Quotation & PFI", "Payment", "Released to Depot", "Loading", "On the Way", "Delivered"],
    );
  });

  it("marks the step being waited on as active, earlier steps done, later pending", () => {
    const pending = "pending";
    assert.deepEqual(states("SUBMITTED"), ["done", "active", pending, pending, pending, pending, pending]);
    for (const status of ["ODOO_SYNC_PENDING", "QUOTATION_CREATING", "QUOTATION_READY", "PFI_PENDING"] as const) {
      assert.deepEqual(states(status), ["done", "active", pending, pending, pending, pending, pending], status);
      assert.equal(noteOf(status), "Preparing", status);
    }
    assert.equal(noteOf("SUBMITTED"), "Preparing");
  });

  it("shows the PFI step done and payment active once the PFI is out", () => {
    for (const status of ["PFI_ISSUED", "AWAITING_PAYMENT"] as const) {
      assert.deepEqual(states(status), ["done", "done", "active", "pending", "pending", "pending", "pending"], status);
      assert.equal(noteOf(status), "Awaiting payment", status);
    }
    for (const status of ["PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION"] as const) {
      assert.deepEqual(states(status), ["done", "done", "active", "pending", "pending", "pending", "pending"], status);
      assert.equal(noteOf(status), "Verifying", status);
    }
  });

  it("moves through depot release, loading and the road", () => {
    assert.deepEqual(states("PAYMENT_CONFIRMED"), ["done", "done", "done", "active", "pending", "pending", "pending"]);
    assert.deepEqual(states("RELEASED_TO_DEPOT"), ["done", "done", "done", "done", "active", "pending", "pending"]);
    assert.deepEqual(states("LOADING"), ["done", "done", "done", "done", "active", "pending", "pending"]);
    assert.deepEqual(states("LOADED"), ["done", "done", "done", "done", "active", "pending", "pending"]);
    assert.equal(noteOf("LOADED"), "Loaded");
    assert.deepEqual(states("DISPATCHED"), ["done", "done", "done", "done", "done", "active", "pending"]);
    assert.deepEqual(states("IN_TRANSIT"), ["done", "done", "done", "done", "done", "active", "pending"]);
  });

  it("marks every step done once delivered or closed", () => {
    for (const status of ["DELIVERED", "CLOSED"] as const) {
      assert.deepEqual(states(status), Array(7).fill("done"), status);
      assert.equal(dealerTrackerSteps(status).stopped, null);
    }
  });

  it("flags the affected step instead of jumping back to the start", () => {
    assert.deepEqual(states("ODOO_SYNC_FAILED"), ["done", "attention", "pending", "pending", "pending", "pending", "pending"]);
    assert.deepEqual(states("PAYMENT_EXCEPTION"), ["done", "done", "attention", "pending", "pending", "pending", "pending"]);
    assert.deepEqual(states("STOCK_EXCEPTION"), ["done", "done", "done", "done", "attention", "pending", "pending"]);
    assert.deepEqual(states("DELIVERY_EXCEPTION"), ["done", "done", "done", "done", "done", "attention", "pending"]);
    assert.deepEqual(states("REQUIRES_AMENDMENT"), ["attention", "pending", "pending", "pending", "pending", "pending", "pending"]);
    assert.equal(noteOf("PAYMENT_EXCEPTION"), "Needs attention");
  });

  it("stops the tracker for cancelled and rejected orders", () => {
    assert.equal(dealerTrackerSteps("CANCELLED").stopped, "Order cancelled");
    assert.equal(dealerTrackerSteps("REJECTED").stopped, "Order rejected");
    assert.deepEqual(states("CANCELLED"), Array(7).fill("stopped"));
    assert.equal(dealerTrackerSteps("AWAITING_PAYMENT").stopped, null);
  });
});
