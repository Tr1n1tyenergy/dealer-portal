import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canActOnDepotOrder, depotOrderScope, isStaffAccount } from "./access";

describe("staff-only API access", () => {
  it("allows internal staff accounts", () => {
    assert.equal(isStaffAccount("INTERNAL"), true);
  });

  it("refuses dealer and depot accounts", () => {
    assert.equal(isStaffAccount("DEALER"), false);
    assert.equal(isStaffAccount("DEPOT"), false);
  });

  it("refuses a session with no account type", () => {
    assert.equal(isStaffAccount(undefined), false);
    assert.equal(isStaffAccount(""), false);
  });
});

describe("depot order access", () => {
  const nairobi = { role: "DEPOT_MANAGER", depotId: "depot-nairobi" };

  it("lets a depot manager act on their own depot's order", () => {
    assert.equal(canActOnDepotOrder(nairobi, "depot-nairobi"), true);
  });

  it("refuses another depot's order", () => {
    assert.equal(canActOnDepotOrder(nairobi, "depot-mombasa"), false);
  });

  it("refuses an order that has not been released to any depot", () => {
    assert.equal(canActOnDepotOrder(nairobi, null), false);
  });

  it("refuses a depot manager with no depot assigned", () => {
    assert.equal(canActOnDepotOrder({ role: "DEPOT_MANAGER", depotId: null }, "depot-nairobi"), false);
    assert.equal(canActOnDepotOrder({ role: "DEPOT_MANAGER", depotId: null }, null), false);
  });

  it("lets a super admin act on any depot's order", () => {
    assert.equal(canActOnDepotOrder({ role: "SUPER_ADMIN", depotId: null }, "depot-mombasa"), true);
  });

  it("lists only the manager's own depot", () => {
    assert.deepEqual(depotOrderScope(nairobi), { depotId: "depot-nairobi" });
  });

  it("lists nothing for a depot manager with no depot assigned", () => {
    assert.deepEqual(depotOrderScope({ role: "DEPOT_MANAGER", depotId: null }), { id: { in: [] } });
  });

  it("lists every depot for a super admin", () => {
    assert.deepEqual(depotOrderScope({ role: "SUPER_ADMIN", depotId: null }), {});
  });
});
