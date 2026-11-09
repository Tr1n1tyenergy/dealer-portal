import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePumpSales,
  commitLitresField,
  roundToSignificantFigures,
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
  });

  it("rounds to 4 significant figures", () => {
    assert.equal(roundToSignificantFigures(1254.7, 4), 1255);
    assert.equal(roundToSignificantFigures(10.567, 4), 10.57);
    assert.equal(roundToSignificantFigures(0, 4), 0);
  });

  it("commits draft strings to 4 significant figures", () => {
    assert.equal(commitLitresField("10.56789"), "10.57");
    assert.equal(commitLitresField("abc"), "");
  });
});
