# Phase 1: staff roles and the Retail Interface Orders page

**Status:** Approved in conversation on 2026-10-15. Written spec awaiting review.
**Scope source:** `dealer-portal-next-phase-scope-2026-10-14.pdf` (Phase 1), approved by the supervisor on 2026-10-15.
**Portals:** Admin/Staff (main), Dealer (messaging directory only).

## Goal

- Staff have exactly three roles.
- Only Admins and the new **Sales Person Executive** can use the Retail Interface and act on dealer orders.
- Orders move out of the separate Dealer Operations report and into **Retail Interface → Orders**, grouped by stage.

## Decisions (from the conversation)

1. **Three staff roles.** Finance and Sales Rep are removed completely.

   | Stored value | Shown as | Who |
   |---|---|---|
   | `SUPER_ADMIN` | **Admin** | Administrators; can do everything |
   | `SALES_PERSON_EXECUTIVE` (new) | **Sales Person Executive** | Retail/order staff |
   | `STANDARD_USER` | **Staff Member** | All other staff |

   Depot (`DEPOT_MANAGER`) and dealer (`DEALER_ADMIN`, `DEALER_USER`) roles are unchanged.

2. **Access:**

   | Area | Admin | Sales Person Executive | Staff Member |
   |---|---|---|---|
   | Dashboard, Note Taker, Presentations | ✓ | ✓ | ✓ |
   | Retail Interface: Analytics | ✓ | ✓ | ✗ |
   | Retail Interface: Orders | ✓ | ✓ | ✗ |
   | Retail Interface: Messaging | ✓ | ✓ | ✗ |
   | Retail Interface: Users (dealer accounts) | ✓ | ✗ | ✗ |
   | Order duties: retry Odoo sync, generate PFI, confirm payment / flag exception, release to depot | ✓ | ✓ | ✗ |
   | Staff Admin (staff users, activity, settings) | ✓ | ✗ | ✗ |
   | Can message, and can be messaged by, dealers and staff | ✓ | ✓ | ✗ |

3. **Messaging is limited to Admin and Sales Person Executive on the staff side.**
   - Dealers' directories list only those staff, and staff directories list only them plus dealers.
   - A Staff Member gets 403 from the messaging APIs.
   - Existing conversations stay as they are. No new conversation can be started with a Staff Member.

4. **Existing Finance and Sales Rep users become Staff Members.** That way nobody gains access; an Admin promotes the right people afterwards. Staging has none; production is checked before migrating (see Rollout).

5. **The Orders page** replaces `/intelligence/reports/dealer-operations`, which now redirects to `/intelligence/retail/orders`.

## Design

### Shared rules: `src/lib/access.ts`

- `STAFF_ROLES = ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE", "STANDARD_USER"]`. It replaces `INTERNAL_ROLES`, and `isInternalRole` uses it.
- `ROLE_LABELS: Record<string, string>` gives `SUPER_ADMIN` → "Admin", `SALES_PERSON_EXECUTIVE` → "Sales Person Executive", `STANDARD_USER` → "Staff Member", `DEPOT_MANAGER` → "Depot Manager", `DEALER_ADMIN` → "Dealer Admin" and `DEALER_USER` → "Dealer User". `roleLabel(role)` falls back to the raw value.
- `type Permission = "retail.analytics" | "retail.orders" | "retail.messaging" | "retail.users" | "orders.act"`.
- `can(role, permission): boolean` follows table 2. `SUPER_ADMIN` has all five. `SALES_PERSON_EXECUTIVE` has everything except `retail.users`. Every other role has none.
- `canAccessRetail(role)` is true when the role has any `retail.*` permission.
- **Removed:**
  - `canManageCommercialOrders`, `canVerifyPayment` and `canReleaseToDepot` are replaced by `can(role, "orders.act")`.
  - Every `FINANCE` and `SALES_REP` reference is deleted.
- `canOperateDepot` and the depot helpers are unchanged.
- `canUseMessaging(accountType)` from X1 gains a role argument: `canUseMessaging(accountType, role)`.
  - **Dealers:** allowed.
  - **Staff:** allowed only with `can(role, "retail.messaging")`.
  - **Depot:** refused.
- `canMessageUser` refuses a staff target whose role lacks `retail.messaging`, with the reason "This staff member doesn't use messaging."

### Order stages: `src/lib/orders/stages.ts` (new, client-safe)

- `ORDER_STAGES` is an ordered list of `{ key, label }`:

  | Key | Label | Statuses |
  |---|---|---|
  | `pending` | Pending | DRAFT, SUBMITTED, ODOO_SYNC_PENDING, QUOTATION_CREATING, QUOTATION_READY, PFI_PENDING |
  | `awaiting-payment` | Awaiting payment | PFI_ISSUED, AWAITING_PAYMENT |
  | `verification` | Payment verification | PAYMENT_SUBMITTED, PAYMENT_VERIFICATION |
  | `paid` | Payment completed | PAYMENT_CONFIRMED |
  | `depot` | At depot | RELEASED_TO_DEPOT, LOADING, LOADED, DISPATCHED, IN_TRANSIT |
  | `complete` | Order complete | DELIVERED, CLOSED |
  | `exceptions` | Exceptions | ODOO_SYNC_FAILED, PAYMENT_EXCEPTION, STOCK_EXCEPTION, DELIVERY_EXCEPTION, REQUIRES_AMENDMENT, REJECTED, CANCELLED |

  There's also an `all` tab.
- `stageOf(status)` returns the stage key. Every `DealerOrderStatus` value belongs to exactly one stage, and a unit test enforces this.
- `statusLabel(status)` gives readable text, e.g. `PAYMENT_VERIFICATION` → "Payment verification".
- `parseStage(value)` returns a valid key, or `"pending"` (the default tab).

### Database

One Prisma migration:
1. `UPDATE "User" SET role = 'STANDARD_USER' WHERE role IN ('FINANCE','SALES_REP');`
2. Recreate the `Role` enum as SUPER_ADMIN, SALES_PERSON_EXECUTIVE, STANDARD_USER, DEPOT_MANAGER, DEALER_ADMIN, DEALER_USER. This is the standard Postgres rename, create, cast and drop. `User.role` is the only column that uses it, and its default stays `STANDARD_USER`.

### Staff side (Admin/Staff portal)

- **Retail Interface layout** (`src/app/intelligence/retail/layout.tsx`): after `requireInternal()`, a role without `canAccessRetail` is redirected to `/intelligence/dashboard`.
- **Each Retail page** checks its own permission and redirects to `/intelligence/retail` (Analytics) when it's missing: `retail.analytics`, `retail.orders`, `retail.messaging`, or `retail.users` for Users.
- **Retail sidebar** (`retail-shell.tsx`): shows only the items the role is allowed, adds **Orders** (`/intelligence/retail/orders`, after Analytics), and takes the role as a prop from the layout.
- **Module launcher** (`src/lib/modules.ts` and `modules-launcher.tsx`):
  - Each module gets an optional access rule. The Retail Interface tile needs `canAccessRetail`, and the Admin tiles need `SUPER_ADMIN`.
  - The dashboard passes the role, and the launcher shows only the tiles that role may open.
- **Header role label** (`app-shell.tsx`): uses `roleLabel`.
- **Admin → Users** (`users-admin-client.tsx`):
  - The role picker offers Admin, Sales Person Executive and Staff Member.
  - The table shows `roleLabel`.
- **Staff user APIs** (`/api/users`, `/api/users/[id]`): the `role` zod enum becomes `STAFF_ROLES`.
- **Retail → Users API** (`/api/retail/users/[id]`):
  - The role enum becomes the staff roles plus the dealer roles.
  - The internal check allows any of `STAFF_ROLES`, with the error "Staff users may only be Admin, Sales Person Executive or Staff Member."
  - Its picker shows labels.

### Orders page: `/intelligence/retail/orders`

- **Server component.** It requires `retail.orders`, reads `?stage=` (via `parseStage`) and `?q=`, loads orders with the same includes as today's Dealer Operations page (including the latest payment), and loads the depots.
- **Search** (`q`, trimmed, max 100 characters): case-insensitive `contains` on reference, dealer organisation name and station name (`mode: "insensitive"`).
- **Tabs:** one per stage plus All, each with a count. Counts come from one `groupBy` on status, with the same search applied. The selected tab is a link that keeps `q`.
- **Order:** newest first.
- **Columns:** Order, Dealer, Station, Quotation, PFI, Amount (with Paid and the mismatch flag from #20), Status (`statusLabel`, plus the "Last PFI attempt failed" note as today), Action.
- **Actions:** the same buttons and conditions as Dealer Operations, but shown only when `can(role, "orders.act")`:
  - Retry sync on ODOO_SYNC_FAILED;
  - Generate PFI on QUOTATION_READY / PFI_PENDING;
  - Confirm payment / Flag exception on PAYMENT_VERIFICATION;
  - depot select + Release on PAYMENT_CONFIRMED.

  They post to `internalOrderAction`, which revalidates `/intelligence/retail/orders`.
- **Empty states:** "No orders in this stage." and, with a search, "No orders match "<q>"."
- **Style:** Retail Interface CSS (a new `retail-orders.css`, matching the Analytics and Users cards). Usable at phone width, with the table scrolling horizontally inside its card.
- `/intelligence/reports/dealer-operations/page.tsx` becomes `redirect("/intelligence/retail/orders")`.

### Server checks

- **`internalOrderAction`** (`src/lib/orders/actions.ts`):
  - Requires `can(session.user.role, "orders.act")` for every action. Without it, the action returns with no change (no error page) and logs `ORDER_ACTION_REFUSED`.
  - The old per-action role checks are replaced by this one rule.
- **`requireMessagingApi`** (`src/lib/api-auth.ts`): uses `canUseMessaging(accountType, role)`, giving 403 "Messaging is not available for this account." to Staff Members.
- **`listDirectory`** (`src/lib/messaging/service.ts`):
  - Staff targets are filtered to `role IN ('SUPER_ADMIN','SALES_PERSON_EXECUTIVE')` for both staff and dealer viewers.
  - Dealer targets are unchanged.
- The Pusher sign-in route and the conversation routes need no change beyond `requireMessagingApi`.

## Not in Phase 1

- Order detail view, approval and "booked" stage, truck changes (Phase 3).
- Paging on the Orders page.
- Any change to the dealer or depot portals, or to Dealer Admin vs Dealer User (pinned).

## Rollout

1. **Before migrating production,** someone with production access runs, read-only: `select role, count(*) from "User" where role in ('FINANCE','SALES_REP') group by role;` and notes who will become a Staff Member.
2. Migrate staging (`npm run staging:migrate:deploy`) and test there.
3. Migrate production with the guarded `production:migrate:deploy` **before** this code is deployed. The new Prisma client doesn't know FINANCE or SALES_REP. The old code keeps working on the migrated database, except for its Finance/Sales Rep picker options.
4. Deploy. Then an Admin assigns Sales Person Executive to the right people. Role changes apply on their next page load; no re-login is needed.

## Testing

- **Unit tests:**
  - `can()` for every role × permission, plus `canAccessRetail`;
  - `roleLabel`;
  - `canUseMessaging` (dealer ✓, Admin ✓, SPE ✓, Staff Member ✗, depot ✗);
  - `canMessageUser` refusing a Staff Member target;
  - `stageOf` covering every `DealerOrderStatus` exactly once (the enum values are read from `@prisma/client`);
  - `parseStage` and `statusLabel`.
- **Database tests:**
  - `internalOrderAction` refuses a Staff Member, with the order unchanged, and works for an SPE;
  - `listDirectory` hides Staff Members from a dealer.
- **Migration check:** the move of Finance and Sales Rep users to Staff Member can't be covered by a database test once the enum has changed. It's proven by the live check below, which starts from a copy migrated from main with Finance and Sales Rep users seeded.
- **Live check** on a scratch copy (email off), migrated from main with one Finance and one Sales Rep user seeded:
  - after the migration, both are Staff Members;
  - **Staff Member:** no Retail tile, Retail URLs redirect to the dashboard, 403 on the messaging APIs, an order action is refused;
  - **SPE:** Analytics, Orders and Messaging work, Users redirects, and the full order flow works from the Orders page (PFI → payment → confirm → release);
  - **Admin:** everything, including Users;
  - **Dealer directory:** only Admin and SPE staff;
  - the old Dealer Operations URL redirects;
  - search is case-insensitive;
  - no server errors.
- Then a browser walk-through by Adrian as each role.
- Typecheck, lint and production build.

## Branch and commits

`feat/phase1-roles-orders`, from main fbbab6c (includes X1, A1 and X8). Commits:
1. roles and migration;
2. access rules and guards;
3. Orders page;
4. messaging restrictions.
