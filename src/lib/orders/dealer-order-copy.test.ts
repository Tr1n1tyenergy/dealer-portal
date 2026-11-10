import { test } from "node:test";
import assert from "node:assert/strict";
import { dealerTrackerSteps } from "./state-machine";
import { docState, statusCopy } from "./dealer-order-copy";

const GENERIC = "Track each stage of this order as Trinity processes it.";

test("a payment exception asks the dealer to act on the payment document", () => {
  const { steps } = dealerTrackerSteps("PAYMENT_EXCEPTION");
  assert.deepEqual(docState("payment", steps, "PAYMENT_EXCEPTION", true), { label: "Action needed", tone: "action" });
});

test("stopped and exception orders get their own sentence, not the generic one", () => {
  for (const status of ["CANCELLED", "REJECTED", "DELIVERY_EXCEPTION", "STOCK_EXCEPTION"] as const) {
    const { detail } = statusCopy(status);
    assert.notEqual(detail, GENERIC, status);
    assert.ok(detail.length > 0, status);
  }
});

test("orders on the move keep the generic sentence", () => {
  assert.equal(statusCopy("LOADING").detail, GENERIC);
});
