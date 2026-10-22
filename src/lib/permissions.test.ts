import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessRetail, canUser, parseOverrides, PERMISSION_MODULES, type PermissionKey } from "./permissions";

const staff = (role: string, overrides: Record<string, string> | string = "[]") => ({
  accountType: "INTERNAL",
  role,
  permissions: typeof overrides === "string" ? overrides : JSON.stringify(overrides),
});

const EXPECTED_DEFAULTS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: [
    "analytics.view", "orders.view", "orders.act", "messaging.view", "messaging.act",
    "retailUsers.view", "retailUsers.act", "adminUsers.view", "adminUsers.act", "activity.view", "settings.view",
  ],
  SALES_PERSON_EXECUTIVE: ["analytics.view", "orders.view", "orders.act", "messaging.view", "messaging.act"],
  STANDARD_USER: [],
};

describe("canUser", () => {
  it("lists the seven modules in order", () => {
    assert.deepEqual(
      PERMISSION_MODULES.map((m) => m.label),
      ["Retail Analytics", "Orders", "Messaging", "Retail Users", "Admin Users", "Activity Logs", "Settings"],
    );
  });

  it("gives each role exactly its defaults", () => {
    for (const [role, granted] of Object.entries(EXPECTED_DEFAULTS)) {
      for (const m of PERMISSION_MODULES) {
        for (const level of ["view", "act"] as const) {
          const key = `${m.key}.${level}` as PermissionKey;
          assert.equal(canUser(staff(role), m.key, level), granted.includes(key), `${role} ${key}`);
        }
      }
    }
  });

  it("never grants anything to dealers or depots", () => {
    assert.equal(canUser({ accountType: "DEALER", role: "SUPER_ADMIN", permissions: "[]" }, "orders", "view"), false);
    assert.equal(canUser({ accountType: "DEPOT", role: "SUPER_ADMIN", permissions: "[]" }, "orders", "view"), false);
    assert.equal(canUser(null, "orders", "view"), false);
  });

  it("an Allow grants, a Deny removes, and a Deny on View blocks an Allow on Act", () => {
    assert.equal(canUser(staff("STANDARD_USER", { "analytics.view": "allow" }), "analytics", "view"), true);
    assert.equal(canUser(staff("SUPER_ADMIN", { "settings.view": "deny" }), "settings", "view"), false);
    assert.equal(canUser(staff("STANDARD_USER", { "orders.view": "deny", "orders.act": "allow" }), "orders", "act"), false);
  });

  it("Act needs View", () => {
    assert.equal(canUser(staff("SALES_PERSON_EXECUTIVE", { "orders.view": "deny" }), "orders", "act"), false);
    assert.equal(canUser(staff("STANDARD_USER", { "orders.act": "allow" }), "orders", "act"), false);
    assert.equal(canUser(staff("STANDARD_USER", { "orders.view": "allow", "orders.act": "allow" }), "orders", "act"), true);
  });

  it("view-only modules have no Act", () => {
    assert.equal(canUser(staff("SUPER_ADMIN"), "analytics", "act"), false);
    assert.equal(canUser(staff("SUPER_ADMIN", { "analytics.act": "allow" }), "analytics", "act"), false);
  });
});

describe("parseOverrides", () => {
  it("reads old and broken column values as no overrides", () => {
    for (const raw of ["[]", '["reports","note-taker"]', "not json", null, undefined, "", "42"]) {
      assert.deepEqual(parseOverrides(raw), {}, String(raw));
    }
  });

  it("keeps known keys and drops unknown keys and values", () => {
    assert.deepEqual(
      parseOverrides('{"orders.act":"deny","x.view":"allow","settings.view":"maybe","messaging.view":"allow"}'),
      { "orders.act": "deny", "messaging.view": "allow" },
    );
  });

  it("an old list value gives the person exactly their role access", () => {
    const old = staff("SALES_PERSON_EXECUTIVE", '["reports","note-taker","presentations"]');
    assert.equal(canUser(old, "orders", "act"), true);
    assert.equal(canUser(old, "adminUsers", "view"), false);
  });
});

describe("canAccessRetail", () => {
  it("opens the Retail Interface for anyone who can view one of its areas", () => {
    assert.equal(canAccessRetail(staff("SALES_PERSON_EXECUTIVE")), true);
    assert.equal(canAccessRetail(staff("STANDARD_USER")), false);
    assert.equal(canAccessRetail(staff("STANDARD_USER", { "messaging.view": "allow" })), true);
  });
});
