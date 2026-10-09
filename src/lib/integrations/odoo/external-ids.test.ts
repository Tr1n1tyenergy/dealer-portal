import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOdooExternalId } from "./external-ids";

describe("parseOdooExternalId", () => {
  it("splits module and name from an Odoo External ID", () => {
    const parsed = parseOdooExternalId("__export__.stock_warehouse_138_2263a4fc");
    assert.equal(parsed.module, "__export__");
    assert.equal(parsed.name, "stock_warehouse_138_2263a4fc");
  });

  it("rejects values without a module.name shape", () => {
    assert.throws(() => parseOdooExternalId("138"), /Invalid Odoo External ID/);
  });
});
