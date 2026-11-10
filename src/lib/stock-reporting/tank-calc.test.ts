import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTankDip, sumTankSalesByProduct } from "./tank-calc";

describe("calculateTankDip", () => {
  it("matches mockup PMS Tank 1", () => {
    const r = calculateTankDip({ capacity: 100_000, opening: 30_000, closing: 25_000 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.sales, 5_000);
      assert.equal(r.ullage, 75_000);
      assert.equal(r.provisionalReceipt, false);
    }
  });

  it("rejects closing above capacity", () => {
    const r = calculateTankDip({ capacity: 50_000, opening: 10_000, closing: 51_000 });
    assert.equal(r.ok, false);
  });

  it("flags provisional when closing exceeds opening", () => {
    const r = calculateTankDip({ capacity: 50_000, opening: 10_000, closing: 20_000 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.sales, -10_000);
      assert.equal(r.provisionalReceipt, true);
    }
  });
});

describe("sumTankSalesByProduct", () => {
  it("totals mockup tank sales", () => {
    const t = sumTankSalesByProduct([
      { product: "PMS", sales: 5_000 },
      { product: "PMS", sales: 4_000 },
      { product: "AGO", sales: 3_000 },
      { product: "AGO", sales: 2_000 },
    ]);
    assert.equal(t.pms, 9_000);
    assert.equal(t.ago, 5_000);
    assert.equal(t.total, 14_000);
  });
});
