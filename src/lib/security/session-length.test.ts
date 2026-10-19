import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_MAX_AGE_SECONDS } from "./session-length";

describe("session length", () => {
  it("logs people out after 12 hours without using the portal", () => {
    assert.equal(SESSION_MAX_AGE_SECONDS, 12 * 60 * 60);
  });

  it("is the limit NextAuth actually uses", async () => {
    const { authOptions } = await import("@/lib/auth");
    assert.equal(authOptions.session?.maxAge, SESSION_MAX_AGE_SECONDS);
  });
});
