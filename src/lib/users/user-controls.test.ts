import { test } from "node:test";
import assert from "node:assert/strict";
import type { StaffUser } from "@/lib/permissions";
import { adminRowActions, retailUsersControls } from "./user-controls";

const staff = (role: string, permissions: Record<string, string> = {}): StaffUser => ({
  accountType: "INTERNAL",
  role,
  permissions: JSON.stringify(permissions),
});

test("view-only on Users: no invite forms, no row controls", () => {
  assert.deepEqual(retailUsersControls(staff("STANDARD_USER", { "retailUsers.view": "allow" })), { invite: false, manage: false });
});

test("an Admin invites and manages", () => {
  assert.deepEqual(retailUsersControls(staff("SUPER_ADMIN")), { invite: true, manage: true });
});

test("a dealer account gets nothing", () => {
  assert.deepEqual(retailUsersControls({ accountType: "DEALER", role: "DEALER", permissions: "{}" }), { invite: false, manage: false });
});

const NONE = { toggle: false, resetInvite: false, permissions: false, delete: false };
const row = (role: string, accountType = "INTERNAL", email = "someone@trinityenergyltd.com") => ({ role, accountType, email });

test("view-only on Admin users: no row buttons", () => {
  const actor = { ...staff("STANDARD_USER", { "adminUsers.view": "allow" }), email: "v@x.test" };
  assert.deepEqual(adminRowActions(actor, row("STANDARD_USER")), NONE);
});

test("a non-Admin with Act never gets Permissions on an Admin's row", () => {
  const actor = { ...staff("STANDARD_USER", { "adminUsers.view": "allow", "adminUsers.act": "allow" }), email: "a@x.test" };
  assert.equal(adminRowActions(actor, row("SUPER_ADMIN")).permissions, false);
  assert.equal(adminRowActions(actor, row("STANDARD_USER")).permissions, true);
});

test("an Admin gets Permissions on an Admin's row", () => {
  const actor = { ...staff("SUPER_ADMIN"), email: "admin@stress.test" };
  assert.equal(adminRowActions(actor, row("SUPER_ADMIN")).permissions, true);
});

test("no Permissions on a dealer row", () => {
  const actor = { ...staff("SUPER_ADMIN"), email: "admin@stress.test" };
  assert.equal(adminRowActions(actor, row("DEALER", "DEALER")).permissions, false);
});

test("a non-Admin with Act sees no buttons at all on an Admin's row (the server refuses them)", () => {
  const actor = { ...staff("STANDARD_USER", { "adminUsers.view": "allow", "adminUsers.act": "allow" }), email: "a@x.test", id: "u-a" };
  assert.deepEqual(adminRowActions(actor, { ...row("SUPER_ADMIN"), id: "u-admin" }), NONE);
});

test("nobody gets Delete on their own row", () => {
  const actor = { ...staff("SUPER_ADMIN"), email: "admin@stress.test", id: "u-me" };
  assert.equal(adminRowActions(actor, { ...row("SUPER_ADMIN", "INTERNAL", "admin@stress.test"), id: "u-me" }).delete, false);
});
