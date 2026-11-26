import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePumpSales,
  commitLitresField,
  sanitizeNumericLitresDraft,
  sumSalesByProduct,
} from "./pump-calc";

describe("calculatePumpSales", () => {
  it("matches mockup PMS 1 example", () => {
    const r = calculatePumpSales({ opening: 125_430, closing: 130_430, rtt: 20 });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.sales, 4_980);
  });

  it("rejects closing below opening", () => {
    const r = calculatePumpSales({ opening: 100, closing: 99, rtt: 0 });
    assert.equal(r.ok, false);
  });

  it("rejects RTT above movement", () => {
    const r = calculatePumpSales({ opening: 100, closing: 110, rtt: 15 });
    assert.equal(r.ok, false);
  });
});

describe("sumSalesByProduct", () => {
  it("totals PMS and AGO", () => {
    const t = sumSalesByProduct([
      { product: "PMS", sales: 4_980 },
      { product: "PMS", sales: 4_000 },
      { product: "AGO", sales: 2_990 },
      { product: "AGO", sales: 2_000 },
    ]);
    assert.equal(t.pms, 8_980);
    assert.equal(t.ago, 4_990);
    assert.equal(t.total, 13_970);
  });
});

describe("numeric litres field helpers", () => {
  it("strips non-numeric characters while typing", () => {
    assert.equal(sanitizeNumericLitresDraft("12a3.4b5..6"), "123.456");
    assert.equal(sanitizeNumericLitresDraft("227231"), "227,231");
  });

  it("keeps the exact digits that were typed", () => {
    assert.equal(commitLitresField("227220"), "227,220");
    assert.equal(commitLitresField("227,250"), "227,250");
    assert.equal(commitLitresField("10.56789"), "10.56789");
    assert.equal(commitLitresField("1234.321"), "1,234.321");
    assert.equal(commitLitresField("abc"), "");
  });
});
