import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DealerOrderStatus } from "@prisma/client";
import { ORDER_STAGES, parseStage, stageOf, statusLabel } from "./stages";

describe("order stages", () => {
  it("puts every order status in exactly one stage", () => {
    for (const status of Object.values(DealerOrderStatus)) {
      const homes = ORDER_STAGES.filter((stage) => stage.statuses.includes(status));
      assert.equal(homes.length, 1, status);
      assert.equal(stageOf(status), homes[0].key, status);
    }
  });

  it("groups statuses the way the Orders workspace shows them", () => {
    assert.equal(stageOf("QUOTATION_READY"), "quotation");
    assert.equal(stageOf("PFI_ISSUED"), "awaiting-payment");
    assert.equal(stageOf("AWAITING_PAYMENT"), "awaiting-payment");
    assert.equal(stageOf("PAYMENT_SUBMITTED"), "checking-payment");
    assert.equal(stageOf("PAYMENT_CONFIRMED"), "payment-confirmed");
    assert.equal(stageOf("LOADING"), "depot");
    assert.equal(stageOf("IN_TRANSIT"), "transit");
    assert.equal(stageOf("DISPATCHED"), "transit");
    assert.equal(stageOf("CLOSED"), "complete");
    assert.equal(stageOf("CANCELLED"), "exceptions");
  });

  it("defaults unknown stage values to all orders", () => {
    for (const value of ["<script>", "ALL", "", undefined, 42]) assert.equal(parseStage(value), "all", String(value));
    assert.equal(parseStage("all"), "all");
    assert.equal(parseStage("checking-payment"), "checking-payment");
    assert.equal(parseStage("transit"), "transit");
    assert.equal(parseStage("pfi-issued"), "pfi-issued");
  });

  it("labels statuses for people", () => {
    assert.equal(statusLabel("PAYMENT_VERIFICATION"), "Payment verification");
    assert.equal(statusLabel("ODOO_SYNC_FAILED"), "Odoo sync failed");
    assert.equal(statusLabel("PFI_ISSUED"), "PFI issued");
  });
});
