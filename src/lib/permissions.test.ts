import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_MODULES,
  canAccessAppModule,
  canAccessRetail,
  canUser,
  migratePermissionKeys,
  normalizePermissionKeys,
  overridesForDesiredMatrix,
  parseOverrides,
  PERMISSION_MODULES,
  type PermissionKey,
} from "./permissions";

const staff = (role: string, overrides: Record<string, string> | string = "[]") => ({
  accountType: "INTERNAL",
  role,
  permissions: typeof overrides === "string" ? overrides : JSON.stringify(overrides),
});

describe("APP_MODULES", () => {
  it("exposes the five application modules from the mockup", () => {
    assert.deepEqual(
      APP_MODULES.map((m) => m.label),
      ["Dealer Portal", "Retail Module", "Depot Portal", "Note Taker Module", "Presentation Module"],
    );
  });

  it("maps retail tabs to staff portal navigation", () => {
    const retail = APP_MODULES.find((m) => m.id === "retail")!;
    assert.deepEqual(
      retail.tabs.map((t) => t.label),
      ["Orders", "Analytics", "Messages", "Support", "Users", "Settings", "Stock Sale Reporting", "Admin", "Activity Logs"],
    );
  });

  it("maps dealer tabs to dealer header navigation", () => {
    const dealer = APP_MODULES.find((m) => m.id === "dealer")!;
    assert.deepEqual(
      dealer.tabs.map((t) => t.label),
      ["Dashboard", "Orders", "Messages", "Support", "Stock Sale Reporting"],
    );
  });
});

describe("canUser", () => {
  it("lists legacy portal nav modules in order", () => {
    assert.deepEqual(
      PERMISSION_MODULES.map((m) => m.label),
      [
        "Orders",
        "Analytics",
        "Messages",
        "Support",
        "Users",
        "Settings",
        "Stock Sale Reporting",
        "Admin",
        "Activity Logs",
      ],
    );
  });

  it("gives SUPER_ADMIN every key including app-module access", () => {
    assert.equal(canAccessAppModule(staff("SUPER_ADMIN"), "retail"), true);
    assert.equal(canAccessAppModule(staff("SUPER_ADMIN"), "dealer"), true);
    assert.equal(canAccessAppModule(staff("SUPER_ADMIN"), "depot"), true);
    assert.equal(canUser(staff("SUPER_ADMIN"), "orders", "act"), true);
    assert.equal(canUser(staff("SUPER_ADMIN"), "noteSessions", "view"), true);
  });

  it("gives SPE retail + note/pres but not dealer/depot by default", () => {
    assert.equal(canAccessAppModule(staff("SALES_PERSON_EXECUTIVE"), "retail"), true);
    assert.equal(canAccessAppModule(staff("SALES_PERSON_EXECUTIVE"), "noteTaker"), true);
    assert.equal(canAccessAppModule(staff("SALES_PERSON_EXECUTIVE"), "dealer"), false);
    assert.equal(canAccessAppModule(staff("SALES_PERSON_EXECUTIVE"), "depot"), false);
    assert.equal(canUser(staff("SALES_PERSON_EXECUTIVE"), "orders", "act"), true);
    assert.equal(canUser(staff("SALES_PERSON_EXECUTIVE"), "adminUsers", "view"), false);
  });

  it("preserves Note Taker / Presentations for STANDARD_USER without retail", () => {
    assert.equal(canAccessAppModule(staff("STANDARD_USER"), "noteTaker"), true);
    assert.equal(canAccessAppModule(staff("STANDARD_USER"), "presentations"), true);
    assert.equal(canAccessAppModule(staff("STANDARD_USER"), "retail"), false);
    assert.equal(canUser(staff("STANDARD_USER"), "orders", "view"), false);
  });

  it("never grants anything to dealers or depots", () => {
    assert.equal(canUser({ accountType: "DEALER", role: "SUPER_ADMIN", permissions: "[]" }, "orders", "view"), false);
    assert.equal(canUser({ accountType: "DEPOT", role: "SUPER_ADMIN", permissions: "[]" }, "orders", "view"), false);
    assert.equal(canUser(null, "orders", "view"), false);
  });

  it("blocks tab grants when the parent app module is restricted", () => {
    const user = staff("SALES_PERSON_EXECUTIVE", { "accessRetail.view": "deny", "accessRetail.act": "deny" });
    assert.equal(canAccessAppModule(user, "retail"), false);
    assert.equal(canUser(user, "orders", "view"), false);
    assert.equal(canAccessRetail(user), false);
  });

  it("an Allow grants, a Deny removes, and a Deny on View blocks an Allow on Act", () => {
    assert.equal(
      canUser(
        staff("STANDARD_USER", {
          "accessRetail.view": "allow",
          "accessRetail.act": "allow",
          "analytics.view": "allow",
        }),
        "analytics",
        "view",
      ),
      true,
    );
    assert.equal(canUser(staff("SUPER_ADMIN", { "settings.view": "deny" }), "settings", "view"), false);
    assert.equal(
      canUser(staff("STANDARD_USER", { "orders.view": "deny", "orders.act": "allow", "accessRetail.view": "allow" }), "orders", "act"),
      false,
    );
  });

  it("Act needs View", () => {
    assert.equal(canUser(staff("SALES_PERSON_EXECUTIVE", { "orders.view": "deny" }), "orders", "act"), false);
    assert.equal(
      canUser(
        staff("STANDARD_USER", {
          "accessRetail.view": "allow",
          "orders.act": "allow",
        }),
        "orders",
        "act",
      ),
      false,
    );
    assert.equal(
      canUser(
        staff("STANDARD_USER", {
          "accessRetail.view": "allow",
          "orders.view": "allow",
          "orders.act": "allow",
        }),
        "orders",
        "act",
      ),
      true,
    );
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
    assert.equal(
      canAccessRetail(
        staff("STANDARD_USER", {
          "accessRetail.view": "allow",
          "messaging.view": "allow",
        }),
      ),
      true,
    );
  });
});

describe("migratePermissionKeys", () => {
  it("infers accessRetail when legacy retail tabs are present", () => {
    const migrated = migratePermissionKeys(["orders.view", "orders.act"]);
    assert.ok(migrated.includes("accessRetail.view"));
    assert.ok(migrated.includes("orders.view"));
  });
});

describe("overridesForDesiredMatrix", () => {
  it("denies built-in grants that are removed and allows grants that are added", () => {
    const keys = normalizePermissionKeys([
      "accessRetail.view",
      "accessRetail.act",
      "orders.view",
      "orders.act",
      "messaging.view",
    ]);
    const overrides = overridesForDesiredMatrix("SALES_PERSON_EXECUTIVE", keys);
    assert.equal(overrides["messaging.act"], "deny");
    assert.equal(overrides["analytics.view"], "deny");
    assert.equal(overrides["orders.view"], undefined);
    assert.equal(
      canUser(staff("SALES_PERSON_EXECUTIVE", overrides), "orders", "act"),
      true,
    );
    assert.equal(
      canUser(staff("SALES_PERSON_EXECUTIVE", overrides), "messaging", "act"),
      false,
    );
    assert.equal(
      canUser(staff("SALES_PERSON_EXECUTIVE", overrides), "messaging", "view"),
      true,
    );
  });
});
