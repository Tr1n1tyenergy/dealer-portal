import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_MAX_AGE_SECONDS, signedInAfterPasswordChange } from "./session-length";

describe("session length", () => {
  it("logs people out after 12 hours without using the portal", () => {
    assert.equal(SESSION_MAX_AGE_SECONDS, 12 * 60 * 60);
  });

  it("is the limit NextAuth actually uses", async () => {
    const { authOptions } = await import("@/lib/auth");
    assert.equal(authOptions.session?.maxAge, SESSION_MAX_AGE_SECONDS);
  });
});

describe("signedInAfterPasswordChange", () => {
  const changed = new Date("2026-10-21T10:00:00Z");

  it("keeps sessions when the password was never changed through the portal", () => {
    assert.equal(signedInAfterPasswordChange(undefined, null), true);
    assert.equal(signedInAfterPasswordChange(Date.parse("2026-10-01T00:00:00Z"), null), true);
  });

  it("ends a session that signed in before the password changed", () => {
    assert.equal(signedInAfterPasswordChange(Date.parse("2026-10-21T09:59:59Z"), changed), false);
  });

  it("keeps a session that signed in after the change", () => {
    assert.equal(signedInAfterPasswordChange(Date.parse("2026-10-21T10:00:00Z"), changed), true);
  });

  it("ends a session from before this rule existed (no sign-in time) once the password changes", () => {
    assert.equal(signedInAfterPasswordChange(undefined, changed), false);
  });
});
