import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp } from "./client-ip";
import { lockedError, loginErrorMessage } from "./login-errors";

describe("login lock message", () => {
  const fallback = "Invalid credentials.";

  it("states the wait in minutes", () => {
    assert.equal(
      loginErrorMessage(lockedError(600), fallback),
      "Too many sign-in attempts. Try again in 10 minutes, or reset your password."
    );
  });

  it("rounds part of a minute up", () => {
    assert.match(loginErrorMessage(lockedError(61), fallback), /Try again in 2 minutes,/);
  });

  it("uses the singular for one minute or less", () => {
    assert.match(loginErrorMessage(lockedError(60), fallback), /Try again in 1 minute,/);
    assert.match(loginErrorMessage(lockedError(30), fallback), /Try again in 1 minute,/);
  });

  it("falls back to the screen's own message for other errors", () => {
    assert.equal(loginErrorMessage("CredentialsSignin", fallback), fallback);
    assert.equal(loginErrorMessage(null, fallback), fallback);
  });
});

describe("client IP", () => {
  it("takes the first x-forwarded-for entry", () => {
    assert.equal(clientIp({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), "1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    assert.equal(clientIp(new Headers({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  });

  it("reports unknown without headers", () => {
    assert.equal(clientIp({}), "unknown");
    assert.equal(clientIp(undefined), "unknown");
  });
});
