import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePumpSales, litresToCents, centsToLitres } from "./pump-calc";

describe("RTT aggregation into net sales", () => {
  it("deducts aggregated multi-event RTT from meter movement", () => {
    const opening = 125_430;
    const closing = 130_430;
    const events = [10, 10, 5];
    const rtt = centsToLitres(events.reduce((s, v) => s + litresToCents(v), 0));
    assert.equal(rtt, 25);
    const calc = calculatePumpSales({ opening, closing, rtt });
    assert.equal(calc.ok, true);
    if (calc.ok) assert.equal(calc.sales, 4_975);
  });

  it("applies zero RTT when no events recorded", () => {
    const calc = calculatePumpSales({ opening: 100, closing: 150, rtt: 0 });
    assert.equal(calc.ok, true);
    if (calc.ok) assert.equal(calc.sales, 50);
  });

  it("rejects invalid RTT volumes that exceed meter movement", () => {
    const calc = calculatePumpSales({ opening: 100, closing: 110, rtt: 20 });
    assert.equal(calc.ok, false);
  });
});

describe("opening meter continuity rules", () => {
  it("carries prior closing forward as next opening", () => {
    const day1 = { opening: 125_430, closing: 130_430 };
    const day2Opening = day1.closing;
    const day2 = calculatePumpSales({ opening: day2Opening, closing: 136_000, rtt: 0 });
    assert.equal(day2.ok, true);
    if (day2.ok) assert.equal(day2.sales, 5_570);
  });

  it("allows first-ever opening initialization separately from closing", () => {
    const needsInit = true;
    const initialOpening = 75_210;
    assert.equal(needsInit && initialOpening > 0, true);
    const calc = calculatePumpSales({
      opening: initialOpening,
      closing: 76_000,
      rtt: 5,
    });
    assert.equal(calc.ok, true);
    if (calc.ok) assert.equal(calc.sales, 785);
  });
});
