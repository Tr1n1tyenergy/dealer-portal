# Dealer Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every button and link in the Dealer portal either does what its label says or is removed.

**Architecture:**
- **Pure helpers:** two small modules hold the logic as pure functions so they can be unit tested:
  - `src/lib/orders/dealer-views.ts`: list tabs, table rows, Previous/Next neighbours;
  - `src/lib/dealer/nav.ts`: which sidebar item is active.
- **The real list page:** `/dealer/orders` becomes the order list, reusing the `RecentOrders` table.
- **Shell:** `DealerShell` gets a working search, ⌘K, a bell showing the real unread message count, an avatar menu, and a Support card.
- **Clean-up:** the dashboard, order page and messaging links are re-pointed or removed.

**Tech Stack:** Next.js 15 App Router (server pages + client components), Prisma 6 / PostgreSQL, NextAuth v4, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-dealer-navigation-design.md`

## Global Constraints

- **Branch and base:** `feat/dealer-navigation`, rebased onto `origin/main` **after** these are merged:
  - #32 (PFI: `/api/orders/[id]/pfi`, `src/lib/company/pfi-settings.ts`);
  - #34 (messaging rule: `messagingPairAllowed`, filtered `listConversationsForUser`);
  - `fix/order-progress-steps` (tracker; edits the same order page).

  Task 0 checks this.
- **Out of scope:** notifications feed, global document search, Stations page, Account page, quotation / payment-confirmation / delivery-note documents, order summary download.
- **No fake numbers and no "coming soon" controls:** a control works, or it is removed.
- **Tabs:**
  - `?view=` takes `payment`, `documents` or `deliveries`; anything else means All.
  - `?q=` pre-fills the list search.
  - `?submitted=<id>` still redirects to that order.
- **Status sets (verbatim from the spec):**
  - payment = PFI_ISSUED, AWAITING_PAYMENT, PAYMENT_EXCEPTION;
  - documents = has a PFI;
  - deliveries = RELEASED_TO_DEPOT, LOADING, LOADED, DISPATCHED, IN_TRANSIT, DELIVERY_EXCEPTION, DELIVERED, CLOSED.
- **Copy:**
  - search placeholder "Search orders…";
  - menu items "Change password" (→ `/intelligence/forgot-password`) and "Sign out" (→ `signOut({ callbackUrl: "/access" })`).
- **Commits:** never add a `Co-Authored-By` trailer. Every new unit or DB test file is added to the `test` or `test:db` list in `package.json`.
- **Probes:** in an isolated copy against a throwaway database, with `RESEND_API_KEY=""`, and `DATABASE_URL` / `DIRECT_URL` exported in **separate** statements. Never tri_dev.

## Review Focus

1. **Unread count leaking hidden chats:** a dealer with an old dealer-to-dealer chat must not see its messages counted on the bell. Task 4's DB test pins this.
2. **⌘K on the order page:** it must focus "Find another order", not the top-bar search, and must not also trigger the browser's own Ctrl+K search. Task 4 pins the choice in `quickSearchTarget`.
3. **A `?view=` value that isn't a tab** (e.g. a hand-typed `view=foo`) must show All, never an error or an empty list. Task 1 pins this.
4. **Previous/Next at either end and with one order:** the missing side shows disabled, and neither side ever points at the current order. Task 1 pins this.
5. **The sidebar on a single order reached from a tab:** it highlights My Orders, since the URL has no `view`. Task 3 pins this.

---

### Task 0: Rebase onto main

- [ ] **Step 1:** `git fetch origin && git rebase origin/main` on `feat/dealer-navigation`.
- [ ] **Step 2:** Check the dependencies are present:

  ```bash
  git grep -l "messagingPairAllowed" src
  ls src/app/api/orders/[id]/pfi/route.ts src/lib/company/pfi-settings.ts
  git grep -l dealerTrackerSteps src
  ```

  Expected: all three found. If any is missing, **stop and tell Adrian which PR still has to merge.**

### Task 1: Order views, table rows and neighbours

**Files:**
- Create: `src/lib/orders/dealer-views.ts`
- Test: `src/lib/orders/dealer-views.test.ts` (add to `test` in package.json)
- Modify: `src/app/dealer/(portal)/dashboard/page.tsx`: move `statusTone` and the row mapping out of it, into the new module.

**Interfaces:**
- **Produces:**
  - `type DealerOrderView = "all" | "payment" | "documents" | "deliveries"`
  - `parseDealerOrderView(value: string | string[] | undefined): DealerOrderView`
  - `dealerOrderViewWhere(view: DealerOrderView): Prisma.DealerOrderWhereInput`: `{}` for all; `{ status: { in: [...] } }`; `{ proforma: { isNot: null } }` for documents.
  - `DEALER_ORDER_VIEWS: { view: DealerOrderView; label: string; href: string }[]`, in this order:
    - All → `/dealer/orders`
    - Needs payment → `?view=payment`
    - PFIs & Documents → `?view=documents`
    - Deliveries → `?view=deliveries`
  - `toDealerOrderRow(order: DealerOrder & { station: Station; lines: DealerOrderLine[]; proforma: ProFormaInvoice | null }): RecentOrderRow`. The row type gains `hasPfi: boolean`.
  - `orderNeighbours(newestFirst: { id: string }[], currentId: string): { older: string | null; newer: string | null }`

- [ ] **Step 1: Write the failing tests:**
  - `parseDealerOrderView`:
    - `"payment"`, `"documents"` and `"deliveries"` round-trip;
    - `undefined`, `"foo"`, `""` and `["payment","x"]` all give `"all"`.
  - `dealerOrderViewWhere`:
    - `"payment"` deep-equals `{ status: { in: ["PFI_ISSUED","AWAITING_PAYMENT","PAYMENT_EXCEPTION"] } }`;
    - `"deliveries"` holds the eight statuses listed in Global Constraints;
    - `"documents"` deep-equals `{ proforma: { isNot: null } }`;
    - `"all"` deep-equals `{}`.
  - `orderNeighbours` with ids `[c, b, a]` (newest first):
    - `b` gives `{ older: "a", newer: "c" }`;
    - `c` gives `{ older: "b", newer: null }`;
    - `a` gives `{ older: null, newer: "b" }`;
    - `[a]` and `a` gives both null;
    - an unknown id gives both null.
  - `toDealerOrderRow`: `hasPfi` is true only when `proforma` is set; the PMS/AGO litres map as on the dashboard today.
- [ ] **Step 2:** Run `node --import tsx --test src/lib/orders/dealer-views.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the module. Make the dashboard import `toDealerOrderRow` in place of its local `statusTone` and the inline mapping.
- [ ] **Step 4:** Run the same command. Expected: PASS. Then run `npm test` (all pass) and `npx tsc --noEmit` (clean).
- [ ] **Step 5:** Commit: `feat(dealer): order list views, shared order rows and Previous/Next neighbours`.

### Task 2: My Orders list page

**Files:**
- Modify: `src/app/dealer/(portal)/orders/page.tsx`
- Modify: `src/components/dealer/recent-orders.tsx`, `src/components/dealer/recent-orders.css`

**Interfaces:**
- **Consumes:** Task 1.
- **Produces:** `RecentOrders` props become:
  - `orders` and `stations` (as now);
  - `title?: string` (default "Recent Orders");
  - `subtitle?: string`;
  - `showViewAll?: boolean` (default true);
  - `initialQuery?: string` (default "");
  - `tabs?: { label: string; href: string; active: boolean }[]`.

- [ ] **Step 1: Write the page.**
  - Keep the `submitted` redirect.
  - Read `view` with `parseDealerOrderView` and `q` (a string, trimmed, max 100 characters).
  - Query the org's orders with `dealerOrderViewWhere(view)`, newest first, including `station`, `lines` and `proforma`.
  - Render the existing hero (title "My Orders") with `<RecentOrders title="My Orders" showViewAll={false} initialQuery={q} tabs={…from DEALER_ORDER_VIEWS} />`.
  - Keep the "You have not placed any orders yet" empty state **only** when the org has no orders at all. An empty tab shows the table's own "No orders match" row.
- [ ] **Step 2: Change `RecentOrders`.**
  - Render the tabs as `<Link>`s, with `aria-current="page"` on the active one.
  - Use `initialQuery` as the search state's starting value.
  - Hide "View all orders →" when `showViewAll` is false.
  - Remove the disabled "Last 30 Days" select and the ⋮ "More actions" button (and the unused imports).
  - Rows with `hasPfi` get a "View PFI" link to `/api/orders/${id}/pfi` (`target="_blank"`, `rel="noopener"`) next to View.
- [ ] **Step 3:** Run `npx tsc --noEmit && npm run lint`. Expected: clean (the 2 old warnings only).
- [ ] **Step 4:** Commit: `feat(dealer): My Orders is a real list with tabs for payment, PFIs and deliveries`.

### Task 3: Sidebar highlighting and links

**Files:**
- Create: `src/lib/dealer/nav.ts`
- Test: `src/lib/dealer/nav.test.ts` (add to `test`)
- Modify: `src/components/dealer/dealer-shell.tsx`

**Interfaces:**
- **Produces:**
  - `type DealerNavKey = "dashboard" | "place-order" | "orders" | "messaging" | "documents" | "payments" | "deliveries"`
  - `activeDealerNav(pathname: string, view: string | null): DealerNavKey | null`

- [ ] **Step 1: Write the failing tests**, one per row of the spec's sidebar table:
  - `("/dealer/dashboard", null)` → `"dashboard"`
  - `("/dealer/orders/new", null)` → `"place-order"`
  - `("/dealer/orders", null)` → `"orders"`
  - `("/dealer/orders", "foo")` → `"orders"`
  - `("/dealer/orders/abc123", null)` → `"orders"`
  - `("/dealer/orders/abc123", "payment")` → `"orders"` (a single order is always My Orders)
  - `("/dealer/orders", "documents")` → `"documents"`
  - `("/dealer/orders", "payment")` → `"payments"`
  - `("/dealer/orders", "deliveries")` → `"deliveries"`
  - `("/dealer/messaging", null)` → `"messaging"`
  - `("/dealer/elsewhere", null)` → `null`
- [ ] **Step 2:** Run `node --import tsx --test src/lib/dealer/nav.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `activeDealerNav`. In `DealerShell`:
  - read `view` with `useSearchParams()`. Wrap any consumer in `<Suspense>` if the build asks for it;
  - give each nav item a `key: DealerNavKey | null`;
  - set hrefs as in the spec table: Stations → `/dealer/dashboard#stations`, no active key;
  - render **Support** as a `<button>` that calls `openSupport()` (Task 5). Until Task 5 lands, leave it out of this commit;
  - remove **Account** from the sidebar;
  - mark the active item with `aria-current="page"`.
- [ ] **Step 4:** Run the test (PASS), then `npm test` and `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `fix(dealer): each sidebar item opens its own view and highlights correctly`.

### Task 4: Top bar: search, ⌘K, real unread count, avatar menu

**Files:**
- Create: `src/components/dealer/quick-search.ts`: `quickSearchTarget(doc: Pick<Document, "querySelector">): HTMLElement | null` returns `[data-quick-search="page"]` if present, else `[data-quick-search="top"]`; plus `useQuickSearchShortcut()`.
- Create: `src/components/dealer/account-menu.tsx`
- Modify: `src/lib/messaging/service.ts`: add `unreadMessageCount(userId: string): Promise<number>`, the sum of `unreadCount` from `listConversationsForUser(userId)`, so hidden chats are already excluded.
- Modify: `src/app/dealer/(portal)/layout.tsx`: pass `unread`, `email` and `name` to `DealerShell`.
- Modify: `src/components/dealer/dealer-shell.tsx`, `src/app/dealer/dealer-portal.css`
- Test: `src/lib/messaging/service.db.test.ts` (extend the existing suite), `src/components/dealer/quick-search.test.ts` (add to `test`)

- [ ] **Step 1: Write the failing DB test**, in the existing messaging suite:
  - staff sends the dealer 2 messages in an allowed chat;
  - the hidden dealer-to-dealer chat already holds 1 unread message from the other dealer;
  - the dealer sends 1 message;
  - `unreadMessageCount(dealerA)` equals **2**.

  **Write the failing unit test:** `quickSearchTarget` on a stub document where both selectors match returns the `page` element; with only `top`, it returns `top`; with neither, `null`.
- [ ] **Step 2:** Run `RESEND_API_KEY="" npm run test:db` and `node --import tsx --test src/components/dealer/quick-search.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Search:** a `<form role="search">` with `<input name="q" data-quick-search="top" placeholder="Search orders…">`. Submit does `router.push("/dealer/orders?q=" + encodeURIComponent(q))`, and does nothing when the input is blank.
  - **Shortcut:** `useQuickSearchShortcut` listens for `keydown` with `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"`, calls `preventDefault()`, and focuses `quickSearchTarget(document)`.
  - **Bell:** a `<Link href="/dealer/messaging">` with the badge only when `unread > 0`, showing `99+` above 99. `aria-label` is `"Messages, N unread"`.
  - **`AccountMenu`:**
    - a button with `aria-haspopup="menu"` and `aria-expanded`;
    - it closes on Escape and on an outside `mousedown`;
    - it shows `name`, `email`, a "Change password" link and a "Sign out" button.
  - **Order page search:** add `data-quick-search="page"` to the order page's "Find another order" input.
- [ ] **Step 4:** Run both tests (PASS), then `npm test`, `npx tsc --noEmit` and `npm run lint`.
- [ ] **Step 5:** Commit: `feat(dealer): working order search, ⌘K, real unread count on the bell, account menu`.

### Task 5: Support card

**Files:**
- Create: `src/components/dealer/support-card.tsx`: exports `openSupport()`, which dispatches `window` event `"dp:open-support"`, and `<SupportCard />`, which listens for that event.
- Modify: `dealer-shell.tsx`: render `<SupportCard />` and the sidebar Support button.
- Modify: `src/components/dealer/place-order-form.tsx:197`: "Need help?" becomes a `<button type="button" onClick={openSupport}>` with the same class.

- [ ] **Step 1: Implement `SupportCard`.**
  - A `<dialog>`-style modal (`role="dialog"`, `aria-modal`, labelled "Contact Trinity").
  - It shows `PFI_COMPANY.email` as `mailto:` and each of `PFI_COMPANY.phones` as `tel:` (spaces stripped from the href).
  - A Close button. Escape and a click on the backdrop also close it.
  - Focus moves to Close on open.
- [ ] **Step 2:** Run `npx tsc --noEmit && npm run lint`. Expected: clean.
- [ ] **Step 3:** Commit: `feat(dealer): Support opens a contact card with Trinity's email and phones`.

### Task 6: Dashboard, order page and messaging links

**Files:**
- Modify: `src/app/dealer/(portal)/dashboard/page.tsx`
- Modify: `src/app/dealer/(portal)/orders/[id]/page.tsx`
- Modify: `src/components/dealer/order-tracking-nav.tsx`
- Modify: `src/components/messaging/messaging-app.tsx:538-541, 933-948, 981`

- [ ] **Step 1: Dashboard.**
  - Hero links:

    | Link | Goes to |
    |---|---|
    | View all orders | `/dealer/orders` |
    | View quotations | `/dealer/orders` (orders awaiting a PFI have no tab of their own) |
    | View payments | `?view=payment` |
    | Track deliveries | `?view=deliveries` |
    | View delivered | `?view=deliveries` |

  - Quick Actions: View PFIs → `?view=documents`; Make a Payment → `?view=payment`; Track Deliveries → `?view=deliveries`.
  - Remove "View stations →" and the station rows' `ArrowRight`.
- [ ] **Step 2: Order page.**
  - The breadcrumb "My Orders" becomes `<Link href="/dealer/orders">`.
  - Remove the "Download Summary" button.
  - Order Documents rows: only the PFI row (when the PFI exists) is a link with a chevron. Every other row has no chevron and no link styling.
  - `OrderTrackingNav` uses `orderNeighbours`: "Previous" → `older`, "Next" → `newer`.
  - The `⌘K` `<kbd>` stays, since it now works through Task 4.
- [ ] **Step 3: Messaging, dealer side.**
  - Don't render "View Profile" when `isDealerPortal`.
  - Shared Files "View all →" → `/dealer/orders?view=documents`.
  - Recent Orders "View all →" → `/dealer/orders`.
  - Staff links are unchanged.
- [ ] **Step 4:** Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npx next build`. Expected: all clean.
- [ ] **Step 5: Sweep.** List every `<button` in `src/app/dealer`, `src/components/dealer` and the dealer branches of `messaging-app.tsx`. Each must have an `onClick`, be `type="submit"` inside a form, or be intentionally `disabled` with a `title` explaining why. Fix any left over.
- [ ] **Step 6:** Commit: `fix(dealer): dashboard, order page and messaging links go where they say; remove dead controls`.

### Task 7: Live check

- [ ] **Step 1: Set up.**
  - Create a throwaway database (`tri_dealernav`): `prisma migrate deploy`, then seed one dealer org with 2 stations.
  - Seed orders in SUBMITTED, AWAITING_PAYMENT (with PFI), PAYMENT_VERIFICATION, IN_TRANSIT and DELIVERED.
  - Seed one SPE who has sent the dealer 2 unread messages, and one other dealer with an old dealer-to-dealer chat holding an unread message.
  - Start `next dev` from an isolated worktree on a spare port, with explicit env vars and a throwaway `NEXTAUTH_SECRET`.
- [ ] **Step 2: Check, signed in as the dealer:**
  - every sidebar item returns 200 and the right `aria-current`;
  - each tab lists exactly the expected references;
  - `?view=foo` shows All;
  - `?q=<reference>` pre-fills the search and narrows the list;
  - the bell's label says **2** unread;
  - the PFI link returns a PDF;
  - on the order page, Previous = older and Next = newer.
- [ ] **Step 3:** Clean up: stop the server, remove the worktree, drop `tri_dealernav`, and confirm tri_dev's user count is unchanged.
- [ ] **Step 4:** Hand over to Adrian for a browser check (avatar menu, Support card, ⌘K) before the push.
