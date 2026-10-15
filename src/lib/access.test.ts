import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  can,
  canAccessRetail,
  canActOnDepotOrder,
  depotOrderScope,
  isInternalRole,
  isPublicPath,
  isStaffAccount,
  loginPathFor,
  roleLabel,
  STAFF_ROLES,
} from "./access";

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

describe("logged-out redirects", () => {
  it("sends each portal to its own login page", () => {
    assert.equal(loginPathFor("/dealer/orders/abc"), "/dealer/login");
    assert.equal(loginPathFor("/depot/dashboard"), "/depot/login");
    assert.equal(loginPathFor("/intelligence/reports/dealer-operations"), "/intelligence/login");
    assert.equal(loginPathFor("/somewhere-else"), "/access");
  });

  it("keeps the landing, chooser, login, activation and password pages public", () => {
    for (const path of [
      "/",
      "/access",
      "/dealer/login",
      "/dealer/activate",
      "/depot/login",
      "/intelligence/login",
      "/intelligence/forgot-password",
      "/intelligence/reset-password",
      "/intelligence/activate",
    ]) {
      assert.equal(isPublicPath(path), true, path);
    }
    for (const path of ["/dealer/dashboard", "/depot/dashboard", "/intelligence/dashboard", "/dealer/loginx"]) {
      assert.equal(isPublicPath(path), false, path);
    }
  });
});

describe("staff roles", () => {
  it("has exactly three staff roles", () => {
    assert.deepEqual([...STAFF_ROLES], ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE", "STANDARD_USER"]);
    assert.equal(isInternalRole("FINANCE"), false);
    assert.equal(isInternalRole("SALES_REP"), false);
    assert.equal(isInternalRole("SALES_PERSON_EXECUTIVE"), true);
  });

  it("labels roles for people", () => {
    assert.equal(roleLabel("SUPER_ADMIN"), "Admin");
    assert.equal(roleLabel("SALES_PERSON_EXECUTIVE"), "Sales Person Executive");
    assert.equal(roleLabel("STANDARD_USER"), "Staff Member");
    assert.equal(roleLabel("DEPOT_MANAGER"), "Depot Manager");
    assert.equal(roleLabel("SOMETHING_NEW"), "SOMETHING_NEW");
    assert.equal(roleLabel(undefined), "Staff");
  });
});

describe("permissions", () => {
  const all = ["retail.analytics", "retail.orders", "retail.messaging", "retail.users", "orders.act"] as const;

  it("gives Admin everything", () => all.forEach((p) => assert.equal(can("SUPER_ADMIN", p), true, p)));

  it("gives Sales Person Executive everything except retail users", () => {
    all.forEach((p) => assert.equal(can("SALES_PERSON_EXECUTIVE", p), p !== "retail.users", p));
  });

  it("gives everyone else nothing", () => {
    for (const role of ["STANDARD_USER", "DEPOT_MANAGER", "DEALER_ADMIN", "DEALER_USER", "", undefined]) {
      all.forEach((p) => assert.equal(can(role, p), false, `${role} ${p}`));
      assert.equal(canAccessRetail(role), false);
    }
    assert.equal(canAccessRetail("SALES_PERSON_EXECUTIVE"), true);
    assert.equal(canAccessRetail("SUPER_ADMIN"), true);
  });
});
