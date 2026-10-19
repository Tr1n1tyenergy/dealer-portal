import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EPRA_TEMP_PRICES_BY_WAREHOUSE,
  epraUnitPriceForStation,
  epraUnitPriceForWarehouse,
  STATION_DISCOUNT_KES,
} from "./epra-temp-prices";

describe("EPRA prices 15 Oct – 14 Nov 2026", () => {
  it("stores the maximum pump prices exactly as EPRA published them (Annex I)", () => {
    const published = {
      LAKE_OIL_NRB: [226.96, 227.76],
      KPC_NAKURU: [225.73, 226.93],
      KPC_ELDORET: [226.51, 227.71],
      KPC_KISUMU: [226.51, 227.71],
    } as const;
    for (const [key, [pms, ago]] of Object.entries(published)) {
      const row = EPRA_TEMP_PRICES_BY_WAREHOUSE[key as keyof typeof published];
      assert.deepEqual([row.pms, row.ago, row.periodFrom, row.periodTo], [pms, ago, "2026-10-15", "2026-11-14"], key);
    }
  });

  it("takes the KSh 3 station discount off every unit price", () => {
    assert.equal(STATION_DISCOUNT_KES, 3);
    assert.equal(epraUnitPriceForWarehouse("KPC_NAKURU", "PMS"), 222.73);
    assert.equal(epraUnitPriceForWarehouse("KPC_NAKURU", "AGO"), 223.93);
    assert.equal(epraUnitPriceForWarehouse("LAKE_OIL_NRB", "AGO"), 224.76);
    assert.equal(epraUnitPriceForWarehouse("KPC_KISUMU", "PMS"), 223.51);
    assert.equal(epraUnitPriceForStation("nakuru", "PMS"), 222.73);
  });
});
