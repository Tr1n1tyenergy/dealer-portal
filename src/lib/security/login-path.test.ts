import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginPathFor } from "./login-path";

describe("loginPathFor", () => {
  it("sends each account back to its own portal's login after a password reset", () => {
    assert.equal(loginPathFor("DEALER"), "/dealer/login");
    assert.equal(loginPathFor("DEPOT"), "/depot/login");
    assert.equal(loginPathFor("INTERNAL"), "/intelligence/login");
  });

  it("accepts the portal names used in links (?portal=dealer)", () => {
    assert.equal(loginPathFor("dealer"), "/dealer/login");
    assert.equal(loginPathFor("depot"), "/depot/login");
  });

  it("falls back to the staff login for anything else", () => {
    assert.equal(loginPathFor(null), "/intelligence/login");
    assert.equal(loginPathFor("https://evil.example"), "/intelligence/login");
  });
});
