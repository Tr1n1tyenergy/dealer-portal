import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPrimarySuperAdminEmail,
  isProtectedSuperAdminEmail,
  mayDeleteProtectedAdmin,
} from "./protected-admins";

describe("protected-admins", () => {
  it("recognizes protected and primary emails case-insensitively", () => {
    assert.equal(isProtectedSuperAdminEmail("Admin@TrinityEnergyLtd.com"), true);
    assert.equal(isProtectedSuperAdminEmail("executive.admin@trinityenergyltd.com"), true);
    assert.equal(isProtectedSuperAdminEmail("other@trinityenergyltd.com"), false);
    assert.equal(isPrimarySuperAdminEmail("ADMIN@trinityenergyltd.com"), true);
  });

  it("only primary admin may delete protected accounts", () => {
    assert.equal(
      mayDeleteProtectedAdmin("admin@trinityenergyltd.com", "executive.admin@trinityenergyltd.com"),
      true
    );
    assert.equal(
      mayDeleteProtectedAdmin("admin@trinityenergyltd.com", "admin@trinityenergyltd.com"),
      true
    );
    assert.equal(
      mayDeleteProtectedAdmin(
        "executive.admin@trinityenergyltd.com",
        "admin@trinityenergyltd.com"
      ),
      false
    );
    assert.equal(
      mayDeleteProtectedAdmin("other@trinityenergyltd.com", "dealer@example.com"),
      true
    );
  });
});
