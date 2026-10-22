# Per-person Staff Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff access follows role defaults plus each person's Windows-style Allow/Deny ticks (View/Act per module), edited by Admins in a Permissions dialog.

**Architecture:**
- **One pure module, `src/lib/permissions.ts`:** module table, role defaults, override parsing and `canUser`. It's client-safe and edge-safe.
- **The session and JWT carry the raw `User.permissions` string,** so every server and client check calls `canUser(session.user, module, level)`.
- **Writes go through one DB helper** with the last-Admin rule and an activity log entry, behind one API route.

**Tech Stack:** Next.js 15 App Router, NextAuth v4 JWT, Prisma 6 / PostgreSQL, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-user-permissions-design.md`

## Global Constraints

- **Staff only:** `canUser` returns false for any `accountType !== "INTERNAL"`. Dealer and depot portals are unchanged.
- **Modules and levels (exact keys):**
  - `analytics` (view);
  - `orders` (view, act);
  - `messaging` (view, act);
  - `retailUsers` (view, act);
  - `adminUsers` (view, act);
  - `activity` (view);
  - `settings` (view).
- **Role defaults (exact):**

  | Role | Defaults |
  |---|---|
  | SUPER_ADMIN | every key, both levels where the module has them |
  | SALES_PERSON_EXECUTIVE | analytics.view, orders.view, orders.act, messaging.view, messaging.act |
  | STANDARD_USER | none |

- **Decision order:**
  1. Start from the role default.
  2. An **Allow** grants.
  3. A **Deny** removes; Deny always wins over Allow.
  4. **Act requires View.**
  5. A level the module doesn't have is false.
- **Storage:** `User.permissions` JSON object `{"<module>.<level>": "allow"|"deny"}`. **No migration.** Anything else (`[]`, string arrays, bad JSON) means no overrides. Unknown keys are ignored on read.
- **Save validation:** values `allow` | `deny` | `inherit`; keys must be known module.level pairs; at most 14 changes.
- **Only people with `adminUsers.act` may change permissions,** and only for INTERNAL users.
- **Last-Admin rule:** after a save, at least one ACTIVE INTERNAL user must still have `adminUsers.act`. Otherwise refuse with 400 "At least one active person must keep Act on Admin Users."
- **Audit:** every save logs `USER_PERMISSIONS_CHANGED` with meta `{ before, after }`.
- **These stay role-based:**
  - only `SUPER_ADMIN` may invite or promote to `SUPER_ADMIN`;
  - the last-active-Admin role rules;
  - depot access for SUPER_ADMIN;
  - "Admins see everyone's notes/decks/reports" ownership checks.
- **Remove the fake permissions text box** from the create-user form, and the `permissions` field from both user APIs' create/update schemas.
- **Branch `feat/user-permissions`;** no Co-Authored-By trailer; Adrian pushes. Before opening the PR, rebase onto `main`. Expect conflicts with `fix/hide-demo-modules`, `fix/resend-invite`, `fix/disabled-stays-disabled` and `fix/small-ones` (same files).

## Review Focus

1. **A crafted request bypassing the screen:** an SPE with `orders.act` denied posts the staff order form. Nothing changes and `ORDER_ACTION_REFUSED` is logged. Task 3 test.
2. **Old column values:** a user whose `permissions` is `"[]"` or `["reports","note-taker"]` keeps exactly their role access. Task 1 test.
3. **Self-lockout:** the only Admin denies themselves `adminUsers.act`, and the save is refused. Task 5 test.
4. **Messaging peers:** an SPE whose `messaging.view` is denied disappears from a dealer's contact list, and their existing chats are hidden for both sides. Task 4 test.
5. **A stale token after a change:** the change applies on the person's next request, because the JWT is re-hydrated from the DB. Task 2 test.

---

### Task 1: Permission core

**Files:**
- Create: `src/lib/permissions.ts`
- Test: `src/lib/permissions.test.ts` (add to `test` in package.json)

**Interfaces:**
- **Produces:**
  - `type PermissionModule = "analytics"|"orders"|"messaging"|"retailUsers"|"adminUsers"|"activity"|"settings"`
  - `type PermissionLevel = "view"|"act"`
  - `type PermissionKey = \`${PermissionModule}.${PermissionLevel}\``
  - `PERMISSION_MODULES: { key: PermissionModule; label: string; levels: PermissionLevel[] }[]`, in the table order, with labels "Retail Analytics", "Orders", "Messaging", "Retail Users", "Admin Users", "Activity Logs", "Settings"
  - `type StaffUser = { accountType?: string | null; role?: string | null; permissions?: string | null }`
  - `parseOverrides(raw: string | null | undefined): Partial<Record<PermissionKey, "allow"|"deny">>`
  - `roleGrants(role, key: PermissionKey): boolean`
  - `canUser(user: StaffUser | null | undefined, module: PermissionModule, level: PermissionLevel): boolean`
  - `canAccessRetail(user): boolean`: any of analytics.view, orders.view, messaging.view, retailUsers.view

- [ ] **Step 1: Write the failing tests:**
  - role defaults equal the Global Constraints table, for all 3 roles × 7 modules × levels;
  - `canUser({accountType:"DEALER", role:"SUPER_ADMIN"}, "orders", "view") === false`;
  - an Allow grants: a Staff Member with `{"analytics.view":"allow"}` can view analytics;
  - Deny beats Allow on the same key;
  - Deny on `orders.view` blocks `orders.act` for an SPE;
  - an Allow on `orders.act` alone, for a Staff Member, gives false (no view);
  - `canUser(admin, "analytics", "act") === false`;
  - `parseOverrides` returns `{}` for `"[]"`, `'["reports","note-taker"]'`, `"not json"`, `null`;
  - unknown keys and values are dropped;
  - `canAccessRetail`: true for SPE, false for Staff Member, true for a Staff Member allowed `messaging.view`.
- [ ] **Step 2:** `node --import tsx --test src/lib/permissions.test.ts` fails (module missing).
- [ ] **Step 3:** Implement. No imports from Prisma or the server.
- [ ] **Step 4:** Tests pass, then `npm test`.
- [ ] **Step 5:** Commit `feat(staff): permission core — role defaults + Allow/Deny overrides (canUser)`.

### Task 2: Carry permissions in the session

**Files:**
- Modify: `src/lib/auth.ts` (`authorize` return, the `hydrateTokenFromUser` result, the jwt and session callbacks), `src/types/next-auth.d.ts` (`permissions: string` on Session.user, User and JWT)
- Test: `src/lib/security/session-permissions.db.test.ts` (add to `test:db`)

**Interfaces:**
- **Consumes:** none.
- **Produces:** `session.user.permissions: string` (raw column, default `"[]"`), refreshed on every request.

- [ ] **Step 1: Failing DB test.** Create an INTERNAL user with `permissions: '{"orders.act":"deny"}'`, call `authOptions.callbacks.jwt({ token: { id } })`, and assert `token.permissions` equals that string. Update the column, call again, and assert the new value: the change is picked up on the next request.
- [ ] **Step 2:** It fails (`token.permissions` is undefined).
- [ ] **Step 3:** Implement. Set it on sign-in, on hydrate, and copy it into `session.user`.
- [ ] **Step 4:** Test passes; `npx tsc --noEmit` is clean.
- [ ] **Step 5:** Commit `feat(staff): sessions carry the person's permission overrides`.

### Task 3: Switch every staff check to `canUser`

**Files** (each replaces the check shown):

| File | Change |
|---|---|
| `src/lib/access.ts` | delete `Permission`, `PERMISSIONS`, `can`, and the role-based `canAccessRetail`; keep `STAFF_ROLES`, labels and depot helpers |
| `src/lib/api-auth.ts` | `requirePermissionApi(module: PermissionModule, level: PermissionLevel)` uses `canUser(session.user, …)` |
| `src/lib/session.ts` | add `requirePermission(module, level)`: `requireInternal`, else redirect to `/intelligence/dashboard`; keep `requireSuperAdmin` (still used by depot and ownership) |
| `src/middleware.ts` | `/intelligence/admin/users` needs `adminUsers.view`; `/intelligence/admin/activity` needs `activity.view`; `/intelligence/admin/settings` needs `settings.view`. Use `canUser(token, …)`, since the token has accountType, role and permissions |
| `src/app/intelligence/admin/{users,activity,settings}/page.tsx` | `requirePermission("adminUsers"\|"activity"\|"settings", "view")` |
| `src/app/api/users/route.ts` | GET `adminUsers.view`, POST `adminUsers.act` (keep: only SUPER_ADMIN may create a SUPER_ADMIN); drop `permissions` from the create schema and its write |
| `src/app/api/users/[id]/route.ts` | PATCH and DELETE `adminUsers.act`; drop `permissions` from the update schema |
| `src/app/api/retail/users/route.ts`, `src/app/api/retail/stations/route.ts` | `retailUsers.view` |
| `src/app/api/retail/invite/{dealer,staff}/route.ts` | `retailUsers.act` (staff: the SUPER_ADMIN-only check stays) |
| `src/app/api/retail/users/[id]/route.ts` | PATCH and DELETE `adminUsers.act` |
| `src/app/intelligence/retail/layout.tsx` | `canAccessRetail(session.user)` |
| `src/app/intelligence/retail/page.tsx` | `analytics.view` |
| `src/app/intelligence/retail/orders/page.tsx` | `orders.view`; `mayAct = canUser(…, "orders", "act")` |
| `src/app/intelligence/retail/users/page.tsx` | `retailUsers.view` |
| `src/app/intelligence/retail/messaging/page.tsx` | `messaging.view`; `canOpenUsers = canUser(…, "retailUsers", "view")` |
| `src/lib/orders/internal-order-actions.ts` | actor type `{ id; accountType; role; permissions }`; `canUser(actor, "orders", "act")` |
| `src/lib/orders/actions.ts` | passes `session.user` (already) |
| `src/lib/orders/pfi-access.ts` | INTERNAL → `canUser(viewer, "orders", "view")`; the viewer type gains `permissions` |
| `src/components/retail/retail-shell.tsx` | nav items carry `[module, level]`; filter with `canUser(user, …)`; prop `user: StaffUser` replaces `role` |
| `src/components/retail/retail-users-client.tsx` | `canManageUsers = canUser(session.user, "adminUsers", "act")` |
| `src/lib/modules.ts` | `allowed?: (user: StaffUser) => boolean`; retail tile `canAccessRetail`; Users `adminUsers.view`; Activity `activity.view`; Settings `settings.view`; `visibleModules(user: StaffUser)` |
| `src/components/dashboard/module-cards.tsx`, `modules-launcher.tsx`, `src/app/intelligence/dashboard/page.tsx` | pass `user` instead of `role` |

- **Tests:**
  - update `src/lib/access.test.ts`: the module tests call `visibleModules({ accountType: "INTERNAL", role, permissions: "[]" })`, plus a new case where a Staff Member with `analytics.view` allowed sees the retail tile;
  - update `src/lib/orders/pfi-access.test.ts` (viewer objects gain `permissions`);
  - update `src/lib/orders/staff-access.db.test.ts`: actors gain `accountType`/`permissions`; **new case:** an SPE with `{"orders.act":"deny"}` gets `"refused"` from `applyInternalOrderAction` and the order is unchanged.

- [ ] **Step 1:** Write the new and updated test cases first.
- [ ] **Step 2:** They fail.
- [ ] **Step 3:** Make the call-site changes in the table.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm test`, `npm run test:db` and `npm run lint` all pass.
- [ ] **Step 5:** Commit `feat(staff): every staff check uses canUser (role + person's overrides)`.

### Task 4: Messaging eligibility follows `messaging.view` / `messaging.act`

**Files:**
- Modify: `src/lib/messaging/authz.ts`:
  - `canUseMessaging(user: { accountType; role; permissions })`: dealer → true; INTERNAL → `canUser(user, "messaging", "view")`;
  - `messagingPairAllowed(a, b)` uses it;
  - `canMessageUser` takes `actor` and `target` objects with permissions, and refuses an INTERNAL actor without `messaging.act`;
  - delete `MESSAGING_STAFF_ROLES`.
- Modify: `src/lib/messaging/service.ts`:
  - user selects add `permissions` wherever `role` is selected;
  - `listDirectory` loads `{accountType: "INTERNAL", status: ACTIVE}` plus dealers as before, then filters INTERNAL with `canUseMessaging` in code;
  - callers of `canMessageUser` pass objects.
- Modify: `src/lib/api-auth.ts` `requireMessagingApi` passes `session.user`.
- Modify: `src/app/api/messaging/conversations/route.ts` (POST) and `src/app/api/messaging/conversations/[id]/messages/route.ts` (POST): an INTERNAL sender also needs `canUser(…, "messaging", "act")`, otherwise 403.
- Test: update `src/lib/messaging/authz.test.ts` to the object signatures. Add to `src/lib/messaging/service.db.test.ts`: an SPE with `{"messaging.view":"deny"}` is absent from a dealer's `listDirectory`, and their chat with that dealer is not in the dealer's `listConversationsForUser`.

- [ ] **Steps 1–5:** failing tests → implement → green (`npm test`, `npm run test:db`) → commit `feat(messaging): who can chat follows each person's Messaging permission`.

### Task 5: Save permissions (helper + API)

**Files:**
- Create: `src/lib/users/permissions-admin.ts`
- Create: `src/app/api/users/[id]/permissions/route.ts`
- Test: `src/lib/users/permissions-admin.db.test.ts` (add to `test:db`)

**Interfaces:**
- **Consumes:** Task 1 (`parseOverrides`, `canUser`, `PERMISSION_MODULES`).
- **Produces:**
  - `savePermissions(actor: { id; accountType; role; permissions }, targetId: string, changes: { key: string; value: "allow"|"deny"|"inherit" }[]): Promise<{ ok: true; permissions: string } | { ok: false; status: 400|403|404; message: string }>`
  - `PUT /api/users/[id]/permissions` with body `{ changes }`, answering `{ permissions }` or `{ error }`.

- [ ] **Step 1: Failing DB tests:**
  - an actor without `adminUsers.act` gets 403;
  - a non-INTERNAL target gets 400;
  - an unknown key gets 400 with "Unknown permission";
  - more than 14 changes gets 400;
  - a save writes `{"orders.act":"deny"}`, and `inherit` removes a key;
  - the only active Admin denying themselves `adminUsers.act` gets 400 with the last-Admin message, and the column is unchanged;
  - with two Admins, it succeeds;
  - an activity row `USER_PERMISSIONS_CHANGED` exists, with before and after.
- [ ] **Step 2:** The tests fail.
- [ ] **Step 3:** Implement:
  - one transaction: read the target, merge the changes, validate, then check the last-Admin rule;
  - the last-Admin check loads ACTIVE INTERNAL users' `role`/`permissions`, substitutes the target's new value, and requires at least one with `canUser(…, "adminUsers", "act")`;
  - write, then `logActivity`;
  - the route uses `requirePermissionApi("adminUsers", "act")`, `readJson` and a zod schema, then calls the helper.
- [ ] **Step 4:** Tests pass, `npm run test:db`.
- [ ] **Step 5:** Commit `feat(admin): save a person's permissions (last-Admin rule, audit log)`.

### Task 6: Permissions dialog; remove the fake box

**Files:**
- Create: `src/components/admin/permissions-dialog.tsx`
- Modify: `src/components/admin/users-admin-client.tsx`:
  - a "Permissions" button on INTERNAL rows when the viewer has `adminUsers.act`;
  - remove the permissions text field and its payload.
- Modify: `src/app/intelligence/admin/users/page.tsx`: pass `accountType`, `role` and `permissions` per row, plus the viewer's `canManage`.

**Interfaces:** consumes Task 1 (`PERMISSION_MODULES`, `roleGrants`, `parseOverrides`, `canUser`) and Task 5 (the PUT route).

- [ ] **Step 1: Build the dialog:**
  - title "Permissions for {name} ({roleLabel})";
  - a table with one row per module, and for each level the module has, an **Allow** and a **Deny** checkbox;
  - **role-default ticks** show checked, disabled and grey (an "inherited" note);
  - **ticking** Allow or Deny sets that override and clears the opposite one; **unticking** sets `inherit`;
  - under each row, the result of `canUser` with the pending overrides: "Can view and act", "Can view", or "No access";
  - **Save** sends the changes with PUT, then refreshes; errors show inside the dialog; **Cancel** closes;
  - Escape closes, and focus moves to the first checkbox on open.
- [ ] **Step 2:** `npx tsc --noEmit` and `npm run lint` pass.
- [ ] **Step 3:** Commit `feat(admin): Permissions dialog (Allow/Deny per module, inherited ticks greyed); remove the fake permissions box`.

### Task 7: Live check

- [ ] **Step 1:** Throwaway database `tri_perms` (migrate and seed): one Admin, one SPE, one Staff Member, one dealer org with an order at PAYMENT_VERIFICATION. Run `next start` from an isolated worktree, with RESEND blank and a throwaway NEXTAUTH_SECRET.
- [ ] **Step 2: As the Admin:**
  - PUT `{"orders.act":"deny"}` for the SPE;
  - PUT `{"analytics.view":"allow"}` for the Staff Member;
  - try denying the Admin's own `adminUsers.act`: expect 400.
- [ ] **Step 3: As the SPE:**
  - the Orders page has no action buttons;
  - a crafted `confirm-payment` post leaves the order at PAYMENT_VERIFICATION.
- [ ] **Step 4: As the Staff Member:** `/intelligence/retail` returns 200 and shows the Retail Interface tile on the dashboard; `/intelligence/retail/orders` redirects.
- [ ] **Step 5:** Clean up (server, worktree, DB); tri_dev is untouched.
- [ ] **Step 6:** Hand over to Adrian for a browser check of the dialog.
