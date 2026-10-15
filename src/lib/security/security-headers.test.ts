import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SECURITY_HEADERS } from "./security-headers";

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("stops other sites framing the portals", () => {
    assert.equal(header("X-Frame-Options"), "DENY");
    assert.equal(header("Content-Security-Policy"), "frame-ancestors 'none'");
  });

  it("sets nosniff, referrer policy and HSTS without includeSubDomains", () => {
    assert.equal(header("X-Content-Type-Options"), "nosniff");
    assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.equal(header("Strict-Transport-Security"), "max-age=63072000");
  });

  it("keeps the microphone for the Note Taker and turns camera and location off", () => {
    assert.equal(header("Permissions-Policy"), "camera=(), geolocation=(), microphone=(self)");
  });
});
