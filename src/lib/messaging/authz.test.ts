import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMessageUser, canUseMessaging, messagingPairAllowed } from "./authz";

const person = (accountType: string, role: string, permissions = "[]") => ({ accountType, role, permissions });
const dealer = person("DEALER", "DEALER_ADMIN");
const dealerUser = person("DEALER", "DEALER_USER");
const admin = person("INTERNAL", "SUPER_ADMIN");
const spe = person("INTERNAL", "SALES_PERSON_EXECUTIVE");
const staffMember = person("INTERNAL", "STANDARD_USER");
const depot = person("DEPOT", "DEPOT_MANAGER");

const start = (actor: ReturnType<typeof person>, target: ReturnType<typeof person>, extra: { status?: string; same?: boolean } = {}) =>
  canMessageUser({
    actor: { id: "a", ...actor },
    target: { id: extra.same ? "a" : "b", status: extra.status ?? "ACTIVE", ...target },
  });

describe("canUseMessaging", () => {
  it("lets dealers, Admins and Sales Person Executives use messaging, and nobody else", () => {
    assert.equal(canUseMessaging(dealer), true);
    assert.equal(canUseMessaging(admin), true);
    assert.equal(canUseMessaging(spe), true);
    assert.equal(canUseMessaging(staffMember), false);
    assert.equal(canUseMessaging(depot), false);
    assert.equal(canUseMessaging({ accountType: undefined, role: undefined }), false);
  });

  it("follows a person's ticks", () => {
    assert.equal(canUseMessaging(person("INTERNAL", "SALES_PERSON_EXECUTIVE", '{"messaging.view":"deny"}')), false);
    assert.equal(canUseMessaging(person("INTERNAL", "STANDARD_USER", '{"messaging.view":"allow"}')), true);
  });
});

describe("who may talk to whom", () => {
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

  it("keeps Staff Members, depots and staff denied Messaging out", () => {
    assert.equal(messagingPairAllowed(dealer, staffMember), false);
    assert.equal(messagingPairAllowed(admin, staffMember), false);
    assert.equal(messagingPairAllowed(admin, depot), false);
    assert.equal(messagingPairAllowed(dealer, person("INTERNAL", "SALES_PERSON_EXECUTIVE", '{"messaging.view":"deny"}')), false);
  });
});

describe("canMessageUser", () => {
  it("allows staff to message dealers", () => {
    assert.deepEqual(start(admin, dealer), { ok: true });
  });

  it("blocks messaging yourself and inactive people", () => {
    assert.equal(start(admin, admin, { same: true }).ok, false);
    assert.equal(start(dealer, admin, { status: "PENDING" }).ok, false);
  });

  it("blocks depot accounts", () => {
    assert.equal(start(admin, depot).ok, false);
  });

  it("refuses a Staff Member as a target, and allows a Sales Person Executive", () => {
    assert.deepEqual(start(dealer, staffMember), { ok: false, reason: "This staff member doesn't use messaging." });
    assert.deepEqual(start(dealer, spe), { ok: true });
  });

  it("refuses a dealer starting a chat with another dealer", () => {
    assert.deepEqual(start(dealer, dealer), { ok: false, reason: "Dealers can only message Trinity staff." });
  });

  it("refuses staff who may view Messaging but not act", () => {
    const viewOnly = person("INTERNAL", "SALES_PERSON_EXECUTIVE", '{"messaging.act":"deny"}');
    assert.deepEqual(start(viewOnly, dealer), { ok: false, reason: "You can read messages but not start chats." });
  });
});
