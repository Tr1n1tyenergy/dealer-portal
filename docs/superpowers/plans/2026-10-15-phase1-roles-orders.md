# Phase 1: Staff Roles and Retail Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** There are three staff roles. Only Admin and Sales Person Executive (SPE) can use the Retail Interface, act on dealer orders and use staff messaging. Orders move to Retail Interface → Orders, with stage tabs.

**Architecture:**
- One rule file (`src/lib/access.ts`: `can(role, permission)`, `roleLabel`, `STAFF_ROLES`) feeds every check: menus, pages, server actions and APIs.
- A client-safe `src/lib/orders/stages.ts` maps order statuses to tabs.
- One Prisma migration recreates the `Role` enum after moving Finance and Sales Rep users to Standard User.

**Tech Stack:** Next.js 15 App Router (server components and server actions), Prisma 6 / PostgreSQL 16, NextAuth v4 JWT, zod, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-10-15-phase1-roles-orders-design.md`

## Global Constraints

- **Stored role values:** `SUPER_ADMIN`, `SALES_PERSON_EXECUTIVE`, `STANDARD_USER`, `DEPOT_MANAGER`, `DEALER_ADMIN` and `DEALER_USER`. `FINANCE` and `SALES_REP` must not appear anywhere in `src/`, `scripts/` or `prisma/schema.prisma` after Task 1.
- **Labels:** SUPER_ADMIN "Admin", SALES_PERSON_EXECUTIVE "Sales Person Executive", STANDARD_USER "Staff Member", DEPOT_MANAGER "Depot Manager", DEALER_ADMIN "Dealer Admin", DEALER_USER "Dealer User".
- **Permissions:** `retail.analytics`, `retail.orders`, `retail.messaging` and `retail.users`, plus `orders.act`.
  - SUPER_ADMIN has all of them.
  - SALES_PERSON_EXECUTIVE has all except `retail.users`.
  - Every other role has none.
- **Copy:**
  - "Messaging is not available for this account." (403);
  - "This staff member doesn't use messaging.";
  - "Staff users may only be Admin, Sales Person Executive or Staff Member.";
  - "No orders in this stage.";
  - `No orders match "<q>".`.
- **Commits** never carry a `Co-Authored-By` trailer.
- **Migrations** go to tri_dev and tri_test only. Never staging or production; the user runs those.
- **Unit tests** run with `npm test`; database tests run with `npm run test:db` (tri_test). New test files must be added to the matching script in `package.json`.

## Review Focus

1. **A Staff Member opens `/intelligence/retail/orders` (or `/messaging`, or `/users`) by URL.** Expected: redirected to `/intelligence/dashboard`, with no data rendered. Pinned in Task 3's live check list and the Task 5 live probe.
2. **A Staff Member sends a crafted `internalOrderAction` POST.** Expected: the order is unchanged, with no error page. Pinned in Task 2's DB test.
3. **A dealer calls `POST /api/messaging/conversations` with a Staff Member's id.** Expected: refused with "This staff member doesn't use messaging." Pinned in Task 4's `canMessageUser` unit test.
4. **`?stage=` is garbage (`?stage=<script>`, `?stage=ALL`, empty).** Expected: the Pending tab, no crash. Pinned in Task 3's `parseStage` test.
5. **The search box contains `%` or `_`.** Expected: matched literally, not as "everything". Pinned in the Task 5 live probe (Prisma escapes wildcards in `contains`, and the probe proves it).

---

### Task 1: Three staff roles, labels and the migration

**Files:**
- Modify: `prisma/schema.prisma:19-27` (the `Role` enum)
- Create: `prisma/migrations/20261015120000_staff_roles/migration.sql`
- Modify: `src/lib/access.ts:1-21`
- Modify:
  - `src/app/api/users/route.ts:21`
  - `src/app/api/users/[id]/route.ts:22`
  - `src/app/api/retail/users/[id]/route.ts:14-16,40-46`
  - `src/app/api/retail/invite/staff/route.ts:21`
- Modify:
  - `src/components/admin/users-admin-client.tsx:158-161,215`
  - `src/components/retail/retail-users-client.tsx:73-75,130,590-594,881-882`
  - `src/components/layout/app-shell.tsx:38-41`
- Modify: `src/lib/orders/service.db.test.ts:55-62`, where the actor becomes `role: "SALES_PERSON_EXECUTIVE"` with `lastName: "Executive"`.
- Test: `src/lib/access.test.ts`

**Interfaces:**
- Produces:
  - `STAFF_ROLES: readonly ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE", "STANDARD_USER"]`;
  - `type StaffRole = (typeof STAFF_ROLES)[number]`;
  - `isInternalRole(role: string): boolean` (now uses STAFF_ROLES);
  - `ROLE_LABELS: Record<string, string>`;
  - `roleLabel(role: string | null | undefined): string`, which falls back to the raw value, or "Staff" for empty.
- Removes `INTERNAL_ROLES`. Tasks 2–4 use `STAFF_ROLES`.

- [ ] **Step 1: Write the failing tests** in `src/lib/access.test.ts`:

```ts
describe("staff roles", () => {
  it("has exactly three staff roles", () => {
    assert.deepEqual([...STAFF_ROLES], ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE", "STANDARD_USER"]);
    assert.equal(isInternalRole("FINANCE"), false);
    assert.equal(isInternalRole("SALES_REP"), false);
    assert.equal(isInternalRole("SALES_PERSON_EXECUTIVE"), true);
  });

  it("labels roles for people", () => {
    assert.equal(roleLabel("SUPER_ADMIN"), "Admin");
    assert.equal(roleLabel("SALES_PERSON_EXECUTIVE"), "Sales Person Executive");
    assert.equal(roleLabel("STANDARD_USER"), "Staff Member");
    assert.equal(roleLabel("DEPOT_MANAGER"), "Depot Manager");
    assert.equal(roleLabel("SOMETHING_NEW"), "SOMETHING_NEW");
    assert.equal(roleLabel(undefined), "Staff");
  });
});
```

- [ ] **Step 2: Run them.** `node --import tsx --test src/lib/access.test.ts`. Expected: FAIL (`STAFF_ROLES` and `roleLabel` aren't exported).

- [ ] **Step 3: Implement the access exports** listed under Interfaces.

- [ ] **Step 4: Update the schema and write the migration.**
  - Enum order in `schema.prisma`: SUPER_ADMIN, SALES_PERSON_EXECUTIVE, STANDARD_USER, DEPOT_MANAGER, DEALER_ADMIN, DEALER_USER.
  - `migration.sql`, exactly:

```sql
UPDATE "User" SET "role" = 'STANDARD_USER' WHERE "role" IN ('FINANCE', 'SALES_REP');
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SALES_PERSON_EXECUTIVE', 'STANDARD_USER', 'DEPOT_MANAGER', 'DEALER_ADMIN', 'DEALER_USER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STANDARD_USER';
DROP TYPE "Role_old";
```

- [ ] **Step 5: Apply locally and check for drift.**
  - Run `npx prisma migrate deploy` against tri_dev (repo `.env`), then against tri_test (`node --env-file=.env.test.local ./node_modules/.bin/prisma migrate deploy`). Then run `npx prisma generate`.
  - Run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <tri_test url>`. Expected: an empty migration (no drift).

- [ ] **Step 6: Remove Finance and Sales Rep everywhere, and switch to labels.**
  - **`/api/users` and `/api/users/[id]`:** `z.enum(STAFF_ROLES)`.
  - **`/api/retail/invite/staff`:** `z.enum(STAFF_ROLES).default("STANDARD_USER")`.
  - **`/api/retail/users/[id]`:**
    - the enum is `[...STAFF_ROLES, "DEALER_ADMIN", "DEALER_USER"]`;
    - an internal user with a role not in STAFF_ROLES gets "Staff users may only be Admin, Sales Person Executive or Staff Member.".
  - **Both pickers** list the three staff roles with `roleLabel` text, and both tables show `roleLabel(u.role)`. `retail-users-client` deletes its local `roleLabel` and imports the shared one; `staffRole` state is typed `StaffRole`.
  - **`app-shell.tsx`:** `roleLabel(data?.user?.role ?? undefined)`. When the role is missing, the department fallback stays.
  - **`service.db.test.ts`:** as listed under Files.

- [ ] **Step 7: Verify.**
  - `grep -rn "FINANCE\|SALES_REP" src scripts prisma/schema.prisma prisma/seed.ts`. Expected: no output.
  - `npm test` and `npm run test:db`. Expected: all pass.
  - `npx tsc --noEmit`. Expected: exit 0.

- [ ] **Step 8: Commit.**

```bash
git add prisma src package.json
git commit -m "feat(roles): three staff roles: Admin, Sales Person Executive, Staff Member

Finance and Sales Rep are removed; the migration moves any such users to
Standard User (Staff Member) before recreating the Role enum."
```

### Task 2: Permissions and the order-action check

**Files:**
- Modify: `src/lib/access.ts`
- Modify: `src/lib/orders/actions.ts:95-117` (`internalOrderAction`)
- Modify: `src/app/intelligence/reports/dealer-operations/page.tsx`. It uses `can(role, "orders.act")` for every button until Task 3 replaces the page.
- Test: `src/lib/access.test.ts`
- Test: `src/lib/orders/staff-access.db.test.ts` (new; add it to `test:db`)

**Interfaces:**
- Consumes: `STAFF_ROLES` from Task 1.
- Produces:
  - `type Permission = "retail.analytics" | "retail.orders" | "retail.messaging" | "retail.users" | "orders.act"`;
  - `can(role: string | null | undefined, permission: Permission): boolean`;
  - `canAccessRetail(role: string | null | undefined): boolean`;
  - `applyInternalOrderAction(actor: { id: string; role: string }, formData: FormData): Promise<"done" | "refused">`, an exported, testable core in `src/lib/orders/actions.ts`.
- `internalOrderAction(formData)` = `requireInternal()` + `applyInternalOrderAction(session.user, formData)` + `revalidatePath("/intelligence/retail/orders")` (keep the old dealer-operations revalidate until Task 3).
- Removes `canManageCommercialOrders`, `canVerifyPayment` and `canReleaseToDepot`.

- [ ] **Step 1: Write the failing unit test** (`access.test.ts`):

```ts
describe("permissions", () => {
  const all = ["retail.analytics", "retail.orders", "retail.messaging", "retail.users", "orders.act"] as const;
  it("gives Admin everything", () => all.forEach((p) => assert.equal(can("SUPER_ADMIN", p), true, p)));
  it("gives Sales Person Executive everything except retail users", () => {
    all.forEach((p) => assert.equal(can("SALES_PERSON_EXECUTIVE", p), p !== "retail.users", p));
  });
  it("gives everyone else nothing", () => {
    for (const role of ["STANDARD_USER", "DEPOT_MANAGER", "DEALER_ADMIN", "DEALER_USER", "", undefined]) {
      all.forEach((p) => assert.equal(can(role, p), false, `${role} ${p}`));
      assert.equal(canAccessRetail(role), false);
    }
    assert.equal(canAccessRetail("SALES_PERSON_EXECUTIVE"), true);
  });
});
```

- [ ] **Step 2: Write the failing DB test** (`staff-access.db.test.ts`). Use the same `_test`-database guard, setup and cleanup pattern as `src/lib/orders/order-input.db.test.ts`.
  - **Setup:** an organisation, a station, a depot, and one STANDARD_USER plus one SALES_PERSON_EXECUTIVE user, with an order in `PAYMENT_VERIFICATION` that has one `PaymentRecord` (amount "1000.00").
  - `it("refuses a Staff Member and leaves the order unchanged")`: `applyInternalOrderAction({ id: staff.id, role: "STANDARD_USER" }, form({ orderId, action: "confirm-payment" }))` resolves to `"refused"`, the status is still `PAYMENT_VERIFICATION`, and an `ActivityLog` row with `action: "ORDER_ACTION_REFUSED"` exists for that actor.
  - `it("lets a Sales Person Executive confirm the payment")`: the same call with the SPE resolves to `"done"`, and the status is `PAYMENT_CONFIRMED`.

- [ ] **Step 3: Run both.** `node --import tsx --test src/lib/access.test.ts` and `npm run test:db`. Expected: FAIL (`can` and `applyInternalOrderAction` aren't exported).

- [ ] **Step 4: Implement.**
  - `can` / `canAccessRetail` per Global Constraints.
  - `applyInternalOrderAction`:
    - if `!can(actor.role, "orders.act")`, log `ORDER_ACTION_REFUSED` (via `logActivity`, with `entity: "DealerOrder"` and `entityId: orderId`) and return `"refused"`;
    - otherwise run the existing four branches (`retry-sync`, `generate-pfi`, `confirm-payment`/`reject-payment`, `release`), keeping `ignoreStaleTransition` and the depot fallback, with no per-action role checks;
    - return `"done"`.
  - Delete the three old helpers and update the dealer-operations page imports.

- [ ] **Step 5: Run.** `npm test`, `npm run test:db` and `npx tsc --noEmit`. Expected: all pass, exit 0.

- [ ] **Step 6: Commit** `feat(access): named permissions; only Admin and Sales Person Executive act on orders`.

### Task 3: Retail Interface guards, menu and module tiles

**Files:**
- Modify: `src/app/intelligence/retail/layout.tsx`
- Modify:
  - `src/app/intelligence/retail/page.tsx`
  - `src/app/intelligence/retail/messaging/page.tsx`
  - `src/app/intelligence/retail/users/page.tsx` (becomes `async`)
- Modify: `src/components/retail/retail-shell.tsx`
- Modify:
  - `src/lib/modules.ts`
  - `src/components/dashboard/modules-launcher.tsx`
  - `src/components/dashboard/module-cards.tsx`
  - `src/app/intelligence/dashboard/page.tsx`
- Create: `src/lib/orders/stages.ts`
- Test: `src/lib/orders/stages.test.ts` (new; add to `test`) and `src/lib/access.test.ts`

**Interfaces:**
- Consumes: `can` and `canAccessRetail` (Task 2), and `roleLabel` (Task 1).
- Produces:
  - `RetailShell({ role, children }: { role: string; children: React.ReactNode })`. Nav items are Analytics (`retail.analytics`), **Orders** (`/intelligence/retail/orders`, `retail.orders`, matched with `p.startsWith("/intelligence/retail/orders")`), Users (`retail.users`) and Messaging (`retail.messaging`), filtered with `can`.
  - `TriModule.allowed?: (role: string) => boolean`. The Retail Interface module uses `canAccessRetail`, and the three admin modules use `role === "SUPER_ADMIN"`.
  - `visibleModules(role: string | null | undefined): TriModule[]` in `src/lib/modules.ts`.
  - `ModuleCards({ role })` passes the role to `ModulesLauncher({ open, onClose, role })`, and both use `visibleModules(role)`.
- Produces, in `src/lib/orders/stages.ts`:
  - `type StageKey = "pending" | "awaiting-payment" | "verification" | "paid" | "depot" | "complete" | "exceptions"`;
  - `ORDER_STAGES: { key: StageKey; label: string; statuses: DealerOrderStatus[] }[]` (the spec's table, in order);
  - `stageOf(status: DealerOrderStatus): StageKey`;
  - `parseStage(value: unknown): StageKey | "all"` (unknown → `"pending"`);
  - `statusLabel(status: string): string`.
  - It imports only the `DealerOrderStatus` **type** from `@prisma/client`, so it stays client-safe.

- [ ] **Step 1: Write the failing tests.**
  - `stages.test.ts`:
    - `it("puts every order status in exactly one stage")`: for each value of `Object.values(DealerOrderStatus)` (runtime import from `@prisma/client`), exactly one `ORDER_STAGES` entry contains it, and `stageOf` returns that entry's key.
    - `it("defaults unknown stage values to pending")`: `parseStage("<script>")`, `parseStage("ALL")`, `parseStage("")` and `parseStage(undefined)` all return `"pending"`; `parseStage("all")` returns `"all"`; `parseStage("verification")` returns `"verification"`.
    - `it("labels statuses for people")`: `statusLabel("PAYMENT_VERIFICATION") === "Payment verification"` and `statusLabel("ODOO_SYNC_FAILED") === "Odoo sync failed"`.
  - `access.test.ts`, `visibleModules`:
    - `STANDARD_USER` gets ids without `"reports"` and without the admin module ids;
    - `SALES_PERSON_EXECUTIVE` includes `"reports"` but no admin ids;
    - `SUPER_ADMIN` gets all of `TRI_MODULES`.

- [ ] **Step 2: Run them.** Expected: FAIL (the modules don't exist yet).

- [ ] **Step 3: Implement `stages.ts` and `visibleModules`.** `statusLabel` lower-cases, replaces `_` with a space, capitalises the first letter, and special-cases `ODOO` → "Odoo" and `PFI` → "PFI".

- [ ] **Step 4: Add the guards.**
  - **Layout:** `const session = await requireInternal(); if (!canAccessRetail(session.user.role)) redirect("/intelligence/dashboard");`, then pass `role` to `RetailShell`.
  - **Each page:** redirect to `/intelligence/retail` when its own permission is missing. Analytics uses `retail.analytics`, messaging `retail.messaging`, users `retail.users`.
  - **Dashboard:** `const session = await requireSession();`, then `<ModuleCards role={session.user.role} />`.

- [ ] **Step 5: Run.** `npm test` and `npx tsc --noEmit`. Expected: pass, exit 0.

- [ ] **Step 6: Commit** `feat(retail): guard the Retail Interface by role; menu and module tiles follow permissions`.

### Task 4: Orders page

**Files:**
- Create:
  - `src/app/intelligence/retail/orders/page.tsx`
  - `src/app/intelligence/retail/retail-orders.css`
- Modify: `src/app/intelligence/reports/dealer-operations/page.tsx`. Its whole body becomes `redirect("/intelligence/retail/orders")`.
- Modify: `src/lib/orders/actions.ts`. Drop the dealer-operations revalidates.

**Interfaces:**
- Consumes:
  - `parseStage`, `ORDER_STAGES`, `stageOf` and `statusLabel` (Task 3);
  - `can` (Task 2);
  - `formatKes` and `sameAmount` (`src/lib/orders/money.ts`, from #20);
  - `internalOrderAction` (Task 2).
- Produces: the route `/intelligence/retail/orders?stage=<key|all>&q=<text>`.

- [ ] **Step 1: Build the page** as a server component.
  - **Inputs:**
    - `retail.orders` is required, else redirect to `/intelligence/retail`;
    - `stage = parseStage(searchParams.stage)`;
    - `q = String(searchParams.q ?? "").trim().slice(0, 100)`.
  - **Search filter:** `where.OR = [{ reference: { contains: q, mode: "insensitive" } }, { dealerOrganization: { name: { contains: q, mode: "insensitive" } } }, { station: { name: { contains: q, mode: "insensitive" } } }]` when `q` is non-empty.
  - **Rows:** add `status: { in: stage's statuses }` unless the stage is `all`. Include `dealerOrganization`, `station`, `proforma` and `payments: { orderBy: { createdAt: "desc" }, take: 1 }`, ordered by `createdAt: "desc"`.
  - **Counts:** `prisma.dealerOrder.groupBy({ by: ["status"], where: searchWhere, _count: true })`, folded with `stageOf`. All = the sum.
  - **Tabs** are `<Link>`s to `?stage=<key>` (keeping `q`), each with a count; the active tab gets `aria-current="page"`. The search is a GET `<form>` with `name="q"` and a hidden `stage`.
  - **Columns and buttons:** as on today's Dealer Operations page (columns Order, Dealer, Station, Quotation, PFI, Amount, Status, Action). The Status column uses `statusLabel`. Buttons render only when `can(role, "orders.act")`.
  - **Empty rows:** "No orders in this stage." or `No orders match "<q>".`.
  - **Style:** `retail-orders.css` follows the card and table look of `retail-users.css`, with the table inside an `overflow-x: auto` wrapper.

- [ ] **Step 2: Replace dealer-operations with the redirect,** and point the `internalOrderAction` revalidate only at `/intelligence/retail/orders`.

- [ ] **Step 3: Verify.**
  - `npx tsc --noEmit`, `npx next lint` and `npm test`. Expected: pass, with the same 2 old lint warnings.
  - Build in a scratch copy (`npx next build`). Expected: exit 0, with `/intelligence/retail/orders` in the route list.

- [ ] **Step 4: Commit** `feat(retail): Orders page with stage tabs and search; Dealer Operations redirects to it`.

### Task 5: Messaging limited to Admin and SPE, then the live check

**Files:**
- Modify:
  - `src/lib/messaging/authz.ts`
  - `src/lib/api-auth.ts` (`requireMessagingApi`)
  - `src/lib/messaging/service.ts` (`listDirectory` and the `canMessageUser` call at ~277)
- Test: `src/lib/messaging/authz.test.ts`; `src/lib/orders/staff-access.db.test.ts` (adds the directory case)

**Interfaces:**
- Consumes: `can` (Task 2).
- Produces:
  - `canUseMessaging(accountType: string | null | undefined, role: string | null | undefined): boolean`:
    - `DEALER` → true;
    - `INTERNAL` → `can(role, "retail.messaging")`;
    - otherwise false.
  - `canMessageUser(params)` gains `targetRole: string`. A staff target without `can(targetRole, "retail.messaging")` gives `{ ok: false, reason: "This staff member doesn't use messaging." }`.
  - `MESSAGING_STAFF_ROLES = ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE"] as const`, used by `listDirectory`.

- [ ] **Step 1: Write the failing tests.**
  - `authz.test.ts`:
    - `canUseMessaging("DEALER", "DEALER_ADMIN")` is true;
    - `("INTERNAL", "SUPER_ADMIN")` and `("INTERNAL", "SALES_PERSON_EXECUTIVE")` are true;
    - `("INTERNAL", "STANDARD_USER")`, `("DEPOT", "DEPOT_MANAGER")` and `(undefined, undefined)` are false;
    - a dealer messaging an `INTERNAL`/`STANDARD_USER` target gets `{ ok: false, reason: "This staff member doesn't use messaging." }`;
    - a dealer messaging an `INTERNAL`/`SALES_PERSON_EXECUTIVE` target is ok;
    - existing tests pass `targetRole`.
  - DB test: `it("hides Staff Members from a dealer's directory")`. `listDirectory(dealer.id)` contains the SPE's id and not the Staff Member's.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`listDirectory`**, for both branches: `where: { id: { not: actorId }, status: "ACTIVE", OR: [{ accountType: "DEALER" }, { accountType: "INTERNAL", role: { in: [...MESSAGING_STAFF_ROLES] } }] }`.
  - **`requireMessagingApi`:** `canUseMessaging(session.user.accountType, session.user.role)`.
  - The `startDirectConversation` call passes `targetRole: peer.role`.

- [ ] **Step 4: Run.** `npm test`, `npm run test:db`, `npx tsc --noEmit` and `npx next lint`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(messaging): staff messaging limited to Admin and Sales Person Executive`.

- [ ] **Step 6: Live check** on a scratch copy.
  - **Setup:** `RESEND_API_KEY=""`, `ODOO_MODE="mock"`, `TRI_ALLOW_MOCK_DEALER_ORDERS=1`, a throwaway database **migrated from main first**. Seed it, then insert one FINANCE and one SALES_REP staff user, migrate to this branch, and check `/intelligence/admin/settings` shows the dev-console email first.
  - **Expected, all PASS:**
    - the Finance and Sales Rep users are now `STANDARD_USER`;
    - **Staff Member** (password set via the seed helper):
      - the dashboard has no Retail tile;
      - `/intelligence/retail`, `/orders`, `/messaging` and `/users` redirect to `/intelligence/dashboard`;
      - `/api/messaging/directory` gives 403;
      - a crafted `internalOrderAction` leaves the order unchanged;
    - **SPE:**
      - Analytics, Orders and Messaging give 200, and `/users` redirects to `/intelligence/retail`;
      - full flow from Orders: place order (dealer) → Generate PFI → dealer pays → Confirm → Release;
      - tab counts change accordingly;
    - **Admin:** all four Retail pages give 200;
    - **dealer:** the directory has no Staff Member;
    - `/intelligence/reports/dealer-operations` redirects to `/intelligence/retail/orders`;
    - `?q=nakuru` matches "Nakuru", `?q=%` doesn't list every order, and `?stage=<script>` shows Pending;
    - the server log has no `⨯` lines.
  - Clean up the scratch copy and database afterwards.
