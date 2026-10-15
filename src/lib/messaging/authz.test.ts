import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMessageUser, canUseMessaging } from "./authz";

describe("canMessageUser", () => {
  it("allows staff to message dealers", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      actorRole: "SUPER_ADMIN",
      targetAccountType: "DEALER",
      targetRole: "DEALER_ADMIN",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, true);
  });

  it("blocks messaging self", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      actorRole: "SUPER_ADMIN",
      targetAccountType: "INTERNAL",
      targetRole: "SUPER_ADMIN",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "a",
    });
    assert.equal(r.ok, false);
  });

  it("blocks pending targets", () => {
    const r = canMessageUser({
      actorAccountType: "DEALER",
      actorRole: "DEALER_ADMIN",
      targetAccountType: "INTERNAL",
      targetRole: "SUPER_ADMIN",
      targetStatus: "PENDING",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, false);
  });

  it("blocks depot accounts", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      actorRole: "SUPER_ADMIN",
      targetAccountType: "DEPOT",
      targetRole: "DEPOT_MANAGER",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, false);
  });
});

describe("canUseMessaging", () => {
  it("lets dealers, Admins and Sales Person Executives use messaging, and nobody else", () => {
    assert.equal(canUseMessaging("DEALER", "DEALER_ADMIN"), true);
    assert.equal(canUseMessaging("INTERNAL", "SUPER_ADMIN"), true);
    assert.equal(canUseMessaging("INTERNAL", "SALES_PERSON_EXECUTIVE"), true);
    assert.equal(canUseMessaging("INTERNAL", "STANDARD_USER"), false);
    assert.equal(canUseMessaging("DEPOT", "DEPOT_MANAGER"), false);
    assert.equal(canUseMessaging(undefined, undefined), false);
  });
});

describe("messaging staff who don't use it", () => {
  const dealerTo = (targetRole: string) =>
    canMessageUser({
      actorAccountType: "DEALER",
      actorRole: "DEALER_ADMIN",
      targetAccountType: "INTERNAL",
      targetRole,
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });

  it("refuses a Staff Member as a target", () => {
    assert.deepEqual(dealerTo("STANDARD_USER"), { ok: false, reason: "This staff member doesn't use messaging." });
  });

  it("allows a Sales Person Executive as a target", () => {
    assert.deepEqual(dealerTo("SALES_PERSON_EXECUTIVE"), { ok: true });
  });
});
