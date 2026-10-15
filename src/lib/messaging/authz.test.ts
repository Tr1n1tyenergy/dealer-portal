import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMessageUser, canUseMessaging } from "./authz";

describe("canMessageUser", () => {
  it("allows staff to message dealers", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      targetAccountType: "DEALER",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, true);
  });

  it("blocks messaging self", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      targetAccountType: "INTERNAL",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "a",
    });
    assert.equal(r.ok, false);
  });

  it("blocks pending targets", () => {
    const r = canMessageUser({
      actorAccountType: "DEALER",
      targetAccountType: "INTERNAL",
      targetStatus: "PENDING",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, false);
  });

  it("blocks depot accounts", () => {
    const r = canMessageUser({
      actorAccountType: "INTERNAL",
      targetAccountType: "DEPOT",
      targetStatus: "ACTIVE",
      actorId: "a",
      targetId: "b",
    });
    assert.equal(r.ok, false);
  });
});

describe("canUseMessaging", () => {
  it("lets staff and dealers use messaging, and nobody else", () => {
    assert.equal(canUseMessaging("INTERNAL"), true);
    assert.equal(canUseMessaging("DEALER"), true);
    assert.equal(canUseMessaging("DEPOT"), false);
    assert.equal(canUseMessaging(undefined), false);
  });
});
