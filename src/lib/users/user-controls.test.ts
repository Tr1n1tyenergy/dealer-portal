import { test } from "node:test";
import assert from "node:assert/strict";
import { retailUsersControls } from "./user-controls";

const staff = (role: string, permissions: Record<string, string> = {}) =>
  ({ accountType: "INTERNAL", role, permissions: JSON.stringify(permissions) }) as never;

test("view-only on Users: no invite forms, no row controls", () => {
  assert.deepEqual(retailUsersControls(staff("STANDARD_USER", { "retailUsers.view": "allow" })), { invite: false, manage: false });
});

test("an Admin invites and manages", () => {
  assert.deepEqual(retailUsersControls(staff("SUPER_ADMIN")), { invite: true, manage: true });
});

test("a dealer account gets nothing", () => {
  assert.deepEqual(retailUsersControls({ accountType: "DEALER", role: "DEALER", permissions: "{}" } as never), { invite: false, manage: false });
});
