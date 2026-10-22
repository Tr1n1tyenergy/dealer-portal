# Per-person permissions for staff (Windows-style Allow / Deny)

**Date:** 2026-10-21 · **Portal side:** Admin/Staff · **Status:** approved in chat, spec for review
**Audit item:** #10 ("The permissions box in Admin → Users does nothing")

## Why

Admin → Users has a "permissions" text box ("reports,note-taker,presentations") that is saved and never read. Access is decided by role alone. Adrian wants it to work like Windows folder permissions: a role gives defaults, and each person can get Allow or Deny ticks per module on top.

## Scope

- **Staff only** (accountType INTERNAL): Admin (SUPER_ADMIN), Sales Person Executive, Staff Member. Dealer and depot portals are unchanged.
- **Granularity:** View + Act per module. Read-only modules have View only.
- **Out of scope:** Note Taker and Presentations (hidden by fix 2); a "who has access to X" report; dealer or depot permissions.

## Modules and role defaults

These defaults are the greyed "inherited" ticks, and they match today's behaviour exactly.

| Key | Module | Levels | Admin | Sales Person Exec | Staff Member |
|---|---|---|---|---|---|
| `analytics` | Retail Analytics | View | View | View | — |
| `orders` | Orders | View, Act | View + Act | View + Act | — |
| `messaging` | Messaging | View, Act | View + Act | View + Act | — |
| `retailUsers` | Retail Users (invite dealers and staff, list) | View, Act | View + Act | — | — |
| `adminUsers` | Admin Users (edit, disable, delete, permissions) | View, Act | View + Act | — | — |
| `activity` | Activity Logs | View | View | — | — |
| `settings` | Settings | View | View | — | — |

**What Act means:**

| Module | Act covers |
|---|---|
| Orders | retry sync, generate or finish PFI, confirm or flag payment, release to depot |
| Messaging | start chats, send messages |
| Retail Users | invite dealers and staff |
| Admin Users | edit, disable, delete, resend invite, change permissions |

## Storage

- The overrides go in the existing `User.permissions` column, which already holds a JSON string. **No migration.**
- Format: an object of `"<module>.<level>": "allow" | "deny"`, for example `{"orders.act":"deny","settings.view":"allow"}`.
- Anything that doesn't parse as that object, including today's `[]` or a list of strings, is read as **no overrides**. Existing users keep exactly their current access.
- Unknown keys or values are ignored on read and refused on save.

## The decision: `canUser(user, module, level)`

Lives in `src/lib/permissions.ts`, client-safe (no database imports).

1. **Non-staff are always refused.** If `user.accountType !== "INTERNAL"`, the answer is false.
2. **Start from the role default** in the table above.
3. **Allow** on `module.level` grants it.
4. **Deny** on `module.level` removes it. Deny always wins over Allow.
5. **Act implies View:**
   - Act needs View to be granted too.
   - A Deny on View therefore also blocks Act.
   - An Allow on Act doesn't grant View by itself.
6. **Levels a module doesn't have:** asking for Act on a View-only module returns false.

**The user shape** used everywhere is `{ accountType, role, permissions }`, where `permissions` is the raw column string. The session and JWT carry `permissions`. The token is already re-hydrated from the database on every request (`src/lib/auth.ts`), so a change applies on the person's next request.

## Replacing today's checks

Every place that decides staff access moves to `canUser` with the session user:
- `can(role, …)`, `canAccessRetail`;
- `requirePermissionApi`, `requireSuperAdmin(Api)` when used for Users, Activity or Settings;
- `adminOnly` in `modules.ts`;
- `MESSAGING_STAFF_ROLES`.

**Mapping:**

| Today | New |
|---|---|
| `retail.analytics` | `analytics.view` |
| `retail.orders` | `orders.view` |
| `orders.act` | `orders.act` |
| `retail.messaging` | `messaging.view` to open; `messaging.act` to start chats and send |
| `retail.users` | `retailUsers.view` / `retailUsers.act` |
| `requireSuperAdmin` on Admin → Users / Activity / Settings | `adminUsers.*`, `activity.view`, `settings.view` |
| Retail Interface tile visible when… | any of analytics, orders, messaging or retailUsers is viewable |

**Messaging eligibility.** Who can chat with whom, `messagingPairAllowed`, and the contact list currently use roles. Both now use `canUser(peer, "messaging", "view")` on the peer's own user record. The directory query loads INTERNAL users and filters them in code, which is fine for about 10 staff.

**These stay role-based on purpose:**
- **Only the Admin role (SUPER_ADMIN) may invite or promote someone to Admin.** Ticks never make anyone an Admin.
- **The last-active-Admin rules** stay as they are.
- **The depot portal's SUPER_ADMIN access** (`requireDepot`) is unchanged; depot access is out of scope.

## Safety rules (server-enforced)

- **Who may edit:** only people with `adminUsers.act`, and only for staff accounts. Editing your own ticks is allowed, subject to the next rule.
- **Last-Admin rule:** the last active Admin must keep `adminUsers.view` and `adminUsers.act`, whoever tries to change it. Refused with 400 and a clear message.
- **Validation:** the route takes a list of `{ key, value: "allow" | "deny" | "inherit" }`.
  - Keys must be in the module table.
  - `inherit` removes an override.
  - At most 14 keys.
- **Audit:** every save writes an Activity Log row, `USER_PERMISSIONS_CHANGED`, with meta `{ before, after }`.

## Screen

- Admin → Users gets a **Permissions** button on each staff row. It's visible to people with `adminUsers.act`.
- The button opens a dialog laid out like Windows' Security tab:
  - title "Permissions for &lt;name&gt; (&lt;role&gt;)";
  - one row per module;
  - **View** and **Act** columns, each with Allow and Deny ticks.
- **Inherited ticks** from the role show greyed and checked. Clicking one adds an explicit override.
- **Effective result:** a line under each row shows the outcome, e.g. "Can view and act" or "No access (denied)".
- **Saving:** Save / Cancel. Errors such as the last-Admin rule show inside the dialog.
- **The create-user form loses its fake "permissions" text box.** New users start with no overrides.

## Tests

- **Unit, `permissions.test.ts`:**
  - each role's defaults equal the table;
  - Allow grants;
  - Deny beats Allow;
  - Act needs View;
  - a View Deny blocks Act;
  - non-INTERNAL is always false;
  - malformed or legacy column values mean no overrides;
  - unknown keys are ignored.
- **Unit, modules:** tiles follow `canUser`. A Staff Member with `analytics.view` allowed sees the Retail Interface tile.
- **DB tests for the save helper:**
  - a non-`adminUsers.act` actor is refused;
  - the last Admin can't deny themselves `adminUsers.*`;
  - overrides are saved;
  - an activity row is written;
  - invalid keys are refused.
- **DB test, messaging:** an SPE with `messaging.view` denied is absent from a dealer's contact list.
- **Live check** on a throwaway database:
  - an SPE denied `orders.act` sees no action buttons, and a crafted form post changes nothing;
  - a Staff Member allowed `analytics.view` can open Retail Analytics;
  - the dialog saves and reloads its ticks.

## Rollout

- No migration. Existing users get no overrides, so behaviour is unchanged until an Admin sets ticks.
- One PR, `feat/user-permissions`.
