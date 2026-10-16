import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATION_FULFILLMENT } from "./quotation-contract";

describe("station Odoo IDs", () => {
  it("gives every portal station an Odoo External ID (account.analytic.account)", () => {
    const missing = STATION_FULFILLMENT.filter((s) => !s.odooStationExternalId).map((s) => s.portalCode);
    assert.deepEqual(missing, []);
    for (const s of STATION_FULFILLMENT) {
      assert.match(s.odooStationExternalId ?? "", /^__export__\.account_analytic_account_\d+_[0-9a-f]{8}$/, s.portalCode);
    }
  });

  it("never gives two stations the same Odoo ID", () => {
    const ids = STATION_FULFILLMENT.map((s) => s.odooStationExternalId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("uses the export's ID for Kisii, not the old numeric id 18", () => {
    const kisii = STATION_FULFILLMENT.find((s) => s.portalCode === "kisii")!;
    assert.equal(kisii.odooStationExternalId, "__export__.account_analytic_account_142_05fb5c2b");
    assert.equal(kisii.odooStationId, null);
  });
});
