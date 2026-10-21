import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMessageUser, canUseMessaging, messagingPairAllowed } from "./authz";

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

describe("MESSAGING_STAFF_ROLES", () => {
  it("is exactly the staff roles with the messaging permission", async () => {
    const { MESSAGING_STAFF_ROLES } = await import("./authz");
    const { can, STAFF_ROLES } = await import("@/lib/access");
    assert.deepEqual([...MESSAGING_STAFF_ROLES], ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE"]);
    assert.deepEqual([...MESSAGING_STAFF_ROLES], STAFF_ROLES.filter((role) => can(role, "retail.messaging")));
  });
});

describe("who may talk to whom", () => {
  const dealer = { accountType: "DEALER", role: "DEALER_ADMIN" } as const;
  const dealerUser = { accountType: "DEALER", role: "DEALER_USER" } as const;
  const admin = { accountType: "INTERNAL", role: "SUPER_ADMIN" } as const;
  const spe = { accountType: "INTERNAL", role: "SALES_PERSON_EXECUTIVE" } as const;
  const staffMember = { accountType: "INTERNAL", role: "STANDARD_USER" } as const;
  const depot = { accountType: "DEPOT", role: "DEPOT_MANAGER" } as const;

  it("lets dealers talk to Admins and Sales Person Executives, both ways", () => {
    assert.equal(messagingPairAllowed(dealer, admin), true);
    assert.equal(messagingPairAllowed(spe, dealerUser), true);
  });

  it("lets Admins and Sales Person Executives talk to each other", () => {
    assert.equal(messagingPairAllowed(admin, spe), true);
    assert.equal(messagingPairAllowed(spe, spe), true);
  });

  it("never lets two dealers talk", () => {
    assert.equal(messagingPairAllowed(dealer, dealerUser), false);
    assert.equal(messagingPairAllowed(dealer, dealer), false);
  });

  it("keeps Staff Members and depots out", () => {
    assert.equal(messagingPairAllowed(dealer, staffMember), false);
    assert.equal(messagingPairAllowed(admin, staffMember), false);
    assert.equal(messagingPairAllowed(admin, depot), false);
  });

  it("refuses a dealer starting a chat with another dealer", () => {
    const r = canMessageUser({
      actorAccountType: "DEALER",
      actorRole: "DEALER_ADMIN",
      targetAccountType: "DEALER",
      targetRole: "DEALER_ADMIN",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });
    assert.deepEqual(r, { ok: false, reason: "Dealers can only message Trinity staff." });
  });
});
