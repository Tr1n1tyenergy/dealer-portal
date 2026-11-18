import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dealerPriceFromParts,
  dealerUnitPriceFromMap,
  truncateTo6Decimals,
  type StationDealerPrices,
} from "./dealer-prices";

describe("Settings dealer price formula", () => {
  it("computes (base − margins) / 1.08 truncated to 6 dp", () => {
    // Athiriver PMS from settings screenshot: 226.96 − 12.59 − 0 = 214.37 → 198.490740…
    assert.equal(dealerPriceFromParts(226.96, 12.59, 0), 198.49074);
    assert.equal(truncateTo6Decimals(198.49074074), 198.49074);
    assert.equal(truncateTo6Decimals(198.49074099), 198.49074);
  });

  it("lands exactly on Finance's price when the maths is exact (no floating-point loss)", () => {
    // Kitale (Eldoret EPRA 226.51 / 227.71, margin 12.5, transport 0.71): Finance lists 197.5 and 198.611111.
    // 213.3 / 1.08 is 197.49999999999997 in floating point; truncating that must still give 197.5.
    assert.equal(dealerPriceFromParts(226.51, 12.5, 0.71), 197.5);
    assert.equal(dealerPriceFromParts(227.71, 12.5, 0.71), 198.611111);
    assert.equal(truncateTo6Decimals(197.49999999999997), 197.5);
  });

  it("does not round up the 6th decimal", () => {
    assert.notEqual(Math.round(198.49074074 * 1e6) / 1e6, truncateTo6Decimals(198.49074074));
    assert.equal(truncateTo6Decimals(1.9999999), 1.999999);
  });

  it("returns null when any part is missing (not treated as zero)", () => {
    assert.equal(dealerPriceFromParts(226.96, null, 0), null);
    assert.equal(dealerPriceFromParts(226.96, 12.59, null), null);
    assert.equal(dealerPriceFromParts(null, 12.59, 0), null);
  });

  it("reads from a preloaded station map", () => {
    const map = new Map<string, StationDealerPrices>([
      ["athiriver", { pms: 198.49074, ago: 199.231481 }],
      ["dagoretti", { pms: null, ago: null }],
    ]);
    assert.equal(dealerUnitPriceFromMap(map, "athiriver", "PMS"), 198.49074);
    assert.equal(dealerUnitPriceFromMap(map, "athiriver", "AGO"), 199.231481);
    assert.equal(dealerUnitPriceFromMap(map, "dagoretti", "PMS"), null);
    assert.equal(dealerUnitPriceFromMap(map, "missing", "PMS"), null);
  });
});
