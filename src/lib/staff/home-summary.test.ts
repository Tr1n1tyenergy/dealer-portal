import { test } from "node:test";
import assert from "node:assert/strict";
import { staffHomeSummary } from "./home-summary";

test("what waits on Trinity, with buttons to the matching Orders tab", () => {
  const s = staffHomeSummary({ PAYMENT_VERIFICATION: 2, PAYMENT_SUBMITTED: 1, PAYMENT_CONFIRMED: 1, ODOO_SYNC_FAILED: 1 });
  assert.equal(s.sentence, "3 payments to check, 1 order to release, 1 order stuck at Odoo.");
  assert.deepEqual(
    s.actions.map((a) => a.href),
    ["/intelligence/retail/orders?stage=verification", "/intelligence/retail/orders?stage=paid"],
  );
  assert.deepEqual(s.actions.map((a) => a.label), ["Check payments", "Release orders"]);
});

test("PFIs to issue are counted from the quotation stages", () => {
  const s = staffHomeSummary({ QUOTATION_READY: 1, PFI_ISSUED: 1 });
  assert.equal(s.sentence, "2 PFIs to issue.");
  assert.deepEqual(s.actions, [{ label: "Issue PFIs", href: "/intelligence/retail/orders?stage=pending" }]);
});

test("nothing waiting", () => {
  assert.deepEqual(staffHomeSummary({}), { sentence: "Nothing waits on Trinity right now.", actions: [] });
});
