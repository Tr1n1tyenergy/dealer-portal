import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EPRA_TEMP_PRICES_BY_WAREHOUSE,
  epraUnitPriceForStation,
  epraUnitPriceForWarehouse,
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

  it("charges dealers the EPRA price itself (the KSh 3 discount ended in October 2026)", () => {
    assert.equal(epraUnitPriceForWarehouse("KPC_NAKURU", "PMS"), 225.73);
    assert.equal(epraUnitPriceForWarehouse("KPC_NAKURU", "AGO"), 226.93);
    assert.equal(epraUnitPriceForWarehouse("LAKE_OIL_NRB", "AGO"), 227.76);
    assert.equal(epraUnitPriceForWarehouse("KPC_KISUMU", "PMS"), 226.51);
    assert.equal(epraUnitPriceForStation("nakuru", "PMS"), 225.73);
  });
});
