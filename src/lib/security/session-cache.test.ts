import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_CACHE_TTL_MS, cachedSession, clearAllSessionCache, invalidateUserSessionCache, rememberSession } from "./session-cache";

describe("session cache: one database lookup per page load, never stale for long", () => {
  it("keeps an answer for 5 seconds at most", () => {
    assert.equal(SESSION_CACHE_TTL_MS, 5_000);
    rememberSession("u1", { id: "u1" }, 1_000);
    assert.deepEqual(cachedSession("u1", 1_000 + 4_999), { hit: true, value: { id: "u1" } });
    assert.deepEqual(cachedSession("u1", 1_000 + 5_000), { hit: false });
  });

  it("remembers a refused (disabled) account too, so it isn't looked up on every request", () => {
    rememberSession("u2", null, 0);
    assert.deepEqual(cachedSession("u2", 10), { hit: true, value: null });
  });

  it("forgets one person, or everyone, on request", () => {
    rememberSession("a", { id: "a" }, 0);
    rememberSession("b", { id: "b" }, 0);
    invalidateUserSessionCache("a");
    assert.deepEqual(cachedSession("a", 1), { hit: false });
    assert.equal(cachedSession("b", 1).hit, true);
    clearAllSessionCache();
    assert.deepEqual(cachedSession("b", 1), { hit: false });
  });
});
