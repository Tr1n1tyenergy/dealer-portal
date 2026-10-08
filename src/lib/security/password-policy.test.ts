import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePasswordStrength } from "./password-policy";

describe("password policy", () => {
  it("rejects short passwords", () => {
    const result = validatePasswordStrength("Ab1!short");
    assert.equal(result.ok, false);
  });

  it("rejects blocked defaults", () => {
    const result = validatePasswordStrength("TrinityAdmin2026!");
    assert.equal(result.ok, false);
  });

  it("accepts a strong unique password", () => {
    const result = validatePasswordStrength("Orchard-Lake-94!tri");
    assert.equal(result.ok, true);
  });
});
