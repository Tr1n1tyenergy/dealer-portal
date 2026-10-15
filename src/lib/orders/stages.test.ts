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

  it("defaults unknown stage values to pending", () => {
    for (const value of ["<script>", "ALL", "", undefined, 42]) assert.equal(parseStage(value), "pending", String(value));
    assert.equal(parseStage("all"), "all");
    assert.equal(parseStage("verification"), "verification");
  });

  it("labels statuses for people", () => {
    assert.equal(statusLabel("PAYMENT_VERIFICATION"), "Payment verification");
    assert.equal(statusLabel("ODOO_SYNC_FAILED"), "Odoo sync failed");
    assert.equal(statusLabel("PFI_ISSUED"), "PFI issued");
  });
});
