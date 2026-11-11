import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEALER_UNIT_PRICES_BY_STATION, dealerUnitPriceForStation } from "./dealer-prices";

const inclVat = (exVat: number) => Math.round(exVat * 1.08 * 100) / 100;

describe("Per-dealer unit prices (Finance list, 11 Nov 2026)", () => {
  it("stores Finance's ex-VAT unit prices exactly as written", () => {
    assert.equal(dealerUnitPriceForStation("migori", "PMS"), 202.518518);
    assert.equal(dealerUnitPriceForStation("migori", "AGO"), 203.629629);
    assert.equal(dealerUnitPriceForStation("magumu", "PMS"), 197.564814);
    assert.equal(dealerUnitPriceForStation("kisii", "AGO"), 205.712962);
    assert.equal(dealerUnitPriceForStation("mumias", "PMS"), 202.518518);
  });

  it("matches what Odoo actually bills once 8% VAT is added", () => {
    // Odoo S01352 (Sure Tech): 218.72 / 219.92 incl; S01310 (Beekey): 213.37 PMS incl.
    assert.equal(inclVat(dealerUnitPriceForStation("migori", "PMS")!), 218.72);
    assert.equal(inclVat(dealerUnitPriceForStation("migori", "AGO")!), 219.92);
    assert.equal(inclVat(dealerUnitPriceForStation("magumu", "PMS")!), 213.37);
  });

  it("prices two-station dealers per station, not per dealer", () => {
    // Vereca: Nakuru vs Banana; Iko Winners: Maili Tatu vs Maua.
    assert.equal(dealerUnitPriceForStation("nakuru", "PMS"), 201.796296);
    assert.equal(dealerUnitPriceForStation("banana", "PMS"), 202.935185);
    assert.notEqual(
      dealerUnitPriceForStation("maili-tatu", "AGO"),
      dealerUnitPriceForStation("maua-town", "AGO")
    );
  });

  it("returns null for stations Finance has not priced", () => {
    for (const code of ["outspan-eldoret", "dagoretti", "kambiti", "malaa", "mariakani", "nope"]) {
      assert.equal(dealerUnitPriceForStation(code, "PMS"), null, code);
      assert.equal(dealerUnitPriceForStation(code, "AGO"), null, code);
    }
  });

  it("covers exactly the 19 stations on Finance's list", () => {
    assert.equal(Object.keys(DEALER_UNIT_PRICES_BY_STATION).length, 19);
  });
});
