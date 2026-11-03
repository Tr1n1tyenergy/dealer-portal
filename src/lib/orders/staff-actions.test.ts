import { test } from "node:test";
import assert from "node:assert/strict";
import { staffOrderActions } from "./staff-actions";

test("payment verification: confirm or flag", () => {
  assert.deepEqual(staffOrderActions("PAYMENT_VERIFICATION"), ["confirm-payment", "reject-payment"]);
});
test("a PFI already issued is finished, not generated again", () => {
  assert.deepEqual(staffOrderActions("PFI_ISSUED"), ["finish-pfi"]);
  assert.deepEqual(staffOrderActions("QUOTATION_READY"), ["generate-pfi"]);
});
test("Odoo sync failed: retry", () => {
  assert.deepEqual(staffOrderActions("ODOO_SYNC_FAILED"), ["retry-sync"]);
});
test("paid: release to depot", () => {
  assert.deepEqual(staffOrderActions("PAYMENT_CONFIRMED"), ["release"]);
});
test("delivered: nothing to do", () => {
  assert.deepEqual(staffOrderActions("DELIVERED"), []);
});
