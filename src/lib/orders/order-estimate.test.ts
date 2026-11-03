import { test } from "node:test";
import assert from "node:assert/strict";
import { orderEstimate } from "./order-estimate";

test("adds 8% VAT on top of the EPRA price", () => {
  const e = orderEstimate({ pms: 1000, ago: 0 }, { pms: 226.51, ago: 227.71 })!;
  assert.deepEqual([e.subtotal, e.vat, e.total], ["226510.00", "18120.80", "244630.80"]);
  assert.deepEqual(e.lines.map((l) => l.product), ["PMS"]);
});

test("both fuels", () => {
  const e = orderEstimate({ pms: 3000, ago: 2000 }, { pms: 226.51, ago: 227.71 })!;
  assert.equal(e.subtotal, "1134950.00");
  assert.equal(e.total, "1225746.00");
});

test("no prices for the station → no estimate", () => {
  assert.equal(orderEstimate({ pms: 1000, ago: 0 }, null), null);
});

test("nothing ordered → no estimate", () => {
  assert.equal(orderEstimate({ pms: 0, ago: 0 }, { pms: 226.51, ago: 227.71 }), null);
});
