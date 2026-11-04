# Live dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff Analytics (direction C), staff Home and dealer Home rebuilt as live, insight-led dashboards from the portal's own data.

**Architecture:**
- Pure insight functions in `src/lib/insights/`, each taking plain rows and `now`, all unit-tested. Pages fetch bounded rows with Prisma and render server-side.
- A best-effort Pusher event after each committed order change. A `LiveRefresh` client component re-renders the page (`router.refresh()`) on that event, and every 60 s as a fallback.
- Charts are SVG drawn at the measured width (`useWidth`).

**Tech Stack:** Next.js 15 app router, Prisma/Postgres, Pusher (server `pusher`, client `pusher-js`, both installed), node:test, Playwright-core checks.

**Spec:** `docs/superpowers/specs/2026-11-03-live-dashboards-design.md`

## Global Constraints

- Branch `feat/portal-redesign`; no attribution lines; nothing pushed by me.
- Stuck limits, verbatim from the spec: Quotation / Odoo sync 2 h · PFI ready, not issued 4 h · Awaiting payment 48 h · Checking payment 24 h · Paid, not released 8 h · At depot (released, loading, loaded) 24 h · On the road 48 h. Each is measured from the latest `OrderStatusHistory.createdAt` into the current status, falling back to `updatedAt`.
- Defaults: active dealer = ≥ 1 order this month; gone quiet = no order in 30 days; dealer waiting = last message in a dealer conversation is from the dealer; Nairobi time for "today" and months; value = `amountDue` (incl. 8% VAT) via `sumKes`. CANCELLED, REJECTED and DRAFT are never counted.
- Pusher payloads carry `{ orderId, status }` only. A Pusher failure never fails an order change.
- Dealers only ever receive their own organisation's data and channel. Staff blocks follow `canUser` exactly as today.
- E2 tokens; text ≥ 13px; every chart has a table view; no sideways scroll at 390px; one `h1`.
- Tests: `npm test` (stress `.env` loaded), `env -u DATABASE_URL RESEND_API_KEY="" npm run test:db`, browser checks on a production build on `tri_stress` (:3996).

## Review Focus

1. An order with no `OrderStatusHistory` row for its current status (old seed data): stuck falls back to `updatedAt`, with no crash and no "NaN h".
2. A month or step with no data: median cycle times show "—", and charts and figures show 0 without dividing by zero.
3. A dealer with several orders on the way, or none: the tracker shows the furthest-along one plus "+ N more", or the block is hidden.
4. Pusher not configured (no keys): pages still load, the badge shows "Updated hh:mm", and the 60 s refresh works.
5. A staff member without `orders.view` asks for `private-orders-staff`, or dealer A asks for dealer B's channel: the request is refused with 403.

Lines 1–3 are pinned by Task 1/2 unit tests, line 5 by the Task 3 DB test, and line 4 by the Task 8 browser check, run with the Pusher keys blank.

---

### Task 1: Order-flow insights

**Files:** Create `src/lib/insights/order-flow.ts` and `.test.ts` (add to the `test` list).

**Interfaces (produces):**
- `STAGE_TILES: { key: string; label: string; statuses: DealerOrderStatus[]; tab: StageKey }[]`, with 8 tiles:
  - Submitted: SUBMITTED, ODOO_SYNC_PENDING → `pending`;
  - Quotation: QUOTATION_CREATING, QUOTATION_READY, ODOO_SYNC_FAILED → `pending`;
  - PFI ready: PFI_PENDING, PFI_ISSUED → `pending`;
  - Awaiting payment: AWAITING_PAYMENT → `awaiting-payment`;
  - Checking payment: PAYMENT_SUBMITTED, PAYMENT_VERIFICATION → `verification`;
  - Paid: PAYMENT_CONFIRMED → `paid`;
  - At depot: RELEASED_TO_DEPOT, LOADING, LOADED → `depot`;
  - On the road: DISPATCHED, IN_TRANSIT → `depot`.
- `stageCounts(rows: { status }[]): { key; label; count; tab }[]`.
- `STUCK_LIMIT_HOURS: Partial<Record<DealerOrderStatus, number>>`, from the Global Constraints.
- `stuckOrders(rows: { id; reference; status; dealer: string; enteredAt: Date | null; updatedAt: Date }[], now: Date): { id; reference; dealer; status; waitedMs; overBy: number }[]`, keeping only orders over their limit, most over first.
- `formatWaited(ms: number): string`: "26 h", "3 d 4 h", "40 min".
- `eventLine(e: { toStatus: string; reference: string; dealer: string; amount?: string | null; depot?: string | null }): string`, worded per status. Examples:
  - SUBMITTED → "{dealer} placed {reference}";
  - PFI_ISSUED / AWAITING_PAYMENT → "PFI issued for {reference} · {dealer}";
  - PAYMENT_SUBMITTED → "{dealer} submitted payment for {reference}";
  - PAYMENT_CONFIRMED → "Payment confirmed for {reference}";
  - PAYMENT_EXCEPTION → "Payment flagged for {reference}";
  - RELEASED_TO_DEPOT → "{reference} released to {depot}";
  - LOADING → "{depot} started loading {reference}";
  - DISPATCHED → "{reference} left {depot}";
  - DELIVERED → "{reference} delivered to {dealer}";
  - anything else → "{reference}: {statusLabel}".
- `cycleMedians(rows: { createdAt; quotedAt; paidAt: Date | null; releasedAt: Date | null; deliveredAt }[]): { step: "Order → PFI" | "PFI → paid" | "Paid → released" | "Released → delivered"; medianMs: number | null }[]`. `paidAt` and `releasedAt` come from the history rows into PAYMENT_CONFIRMED and RELEASED_TO_DEPOT.

- [ ] Step 1: Tests:
  - `stageCounts` buckets every listed status, and ignores DELIVERED and CANCELLED;
  - `stuckOrders` with AWAITING_PAYMENT at 47 h 59 m (not stuck) and 48 h 1 m (stuck), and `enteredAt: null` with an old `updatedAt` (stuck, uses `updatedAt`);
  - `formatWaited(26*3600e3)` → "26 h", `(76*3600e3)` → "3 d 4 h", `(40*60e3)` → "40 min";
  - `eventLine` for each of the 9 statuses above;
  - `cycleMedians` with [2 h, 4 h, 6 h] → 4 h, with no rows → `null`.

  Run: FAIL (module missing).
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Commit `feat(insights): order stages, stuck, events, cycle times`.

### Task 2: Business and personal insights

**Files:** Create `src/lib/insights/business.ts` and `.test.ts`.

**Interfaces (produces):**
- `regionOf(stationCode: string | null): "Nairobi" | "Nakuru" | "Eldoret" | "Kisumu" | null`, via `fulfillmentForStation(code).warehouseKey`: LAKE_OIL_NRB → Nairobi, KPC_NAKURU → Nakuru, KPC_ELDORET → Eldoret, KPC_KISUMU → Kisumu.
- `regionTotals(rows: { stationCode; litres; createdAt }[], now): { region; thisMonth; lastMonth }[]`, always 4 rows in that order.
- `topDealers(rows: { dealer; litres }[], n = 5)`.
- `goneQuiet(dealers: { name; lastOrderAt: Date | null }[], now, days = 30)`, oldest first, with the days since. Dealers with no orders at all are included and shown as "No orders yet".
- `monthSeries(rows: { createdAt; lines }[], now, months = 12)`, which generalises `monthlyLitres` (reuse it; `monthlyLitres` becomes `monthSeries(…, 6)`).
- `monthFigures(rows: { createdAt; status; amountDue; lines; dealerId }[], now): { litres; value; orders; activeDealers; prev: {…same} }`.
- `todayFigures(...)`: new orders today and yesterday; payments confirmed today (count, `sumKes`); litres dispatched today.
- `toPay(orders: { status; amountDue; enteredAt }[], now): { total: string; count: number; oldestMs: number | null }`, over PFI_ISSUED, AWAITING_PAYMENT and PAYMENT_EXCEPTION.
- `onTheWay(orders: { id; status; updatedAt }[]): { current: id | null; more: number }`. Furthest along by tracker step (LOADED > LOADING > RELEASED; DISPATCHED/IN_TRANSIT highest), with the newest breaking ties.

- [ ] Step 1: Tests:
  - `regionOf` for one station code per region and an unknown code (→ null);
  - `regionTotals` across a Nairobi month edge;
  - `goneQuiet` at 29 and 31 days, and with no orders;
  - `monthFigures` with a CANCELLED order excluded, and `activeDealers` counting distinct dealers;
  - `toPay` with 2 × "1225746.00" → total "2451492.00", count 2;
  - `onTheWay` choosing IN_TRANSIT over LOADING, with `more` = 1; empty → `{ current: null, more: 0 }`.

  Run: FAIL.
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Commit `feat(insights): regions, dealers, month and today figures, to-pay, on-the-way`.

### Task 3: Live layer

**Files:**
- Modify: `src/lib/pusher/server-channels.ts` (`ORDERS_STAFF_CHANNEL = "private-orders-staff"`, `ordersDealerChannel(orgId)`), `src/lib/pusher/server.ts` (`notifyOrderChanged(order: { id; status; dealerOrganizationId })`, which is best-effort, never throws, and does nothing when not configured).
- Modify: `src/lib/orders/service.ts`. After each exported function's `$transaction` resolves with an order whose status changed, call `notifyOrderChanged`. The functions are `submitDealerOrder`, `syncQuotation`, `generatePfi`, `submitPayment`, `confirmPayment`, `releaseToDepot` and `applyDepotAction`. Do not call it inside `recordTransition`.
- Modify: `src/app/api/messaging/pusher/auth/route.ts`. Authenticate the session first, then check per channel:
  - conversation: as today (messaging access plus participant);
  - `private-orders-staff`: staff with `canUser(orders,"view")`;
  - `private-orders-dealer-{id}`: a DEALER account whose `dealerOrganizationId === id`;
  - anything else: 403.
- Create: `src/components/live/live-refresh.tsx` (`"use client"`; `LiveRefresh({ channel }: { channel: string })`). It renders the badge, subscribes via `src/lib/pusher/client.ts`, calls `router.refresh()` on `order-changed` (throttled to 1 per 5 s), runs a 60 s interval while `document.visibilityState === "visible"`, and shows "Live · Updated just now" when connected, otherwise "Updated hh:mm".
- Create: `src/lib/live/throttle.ts` + test (`throttle(fn, ms, now)`, pure, injectable clock).
- Test: the auth route in a new `src/app/api/messaging/pusher/auth/route.db.test.ts` (add to `test:db`).

- [ ] Step 1: Tests:
  - throttle: a call inside 5 s is dropped, a call after 5 s fires;
  - auth DB tests, each with Pusher keys set to dummy values for the test:
    - staff with `orders.view` → 200 for `private-orders-staff`;
    - staff without it → 403;
    - dealer → 200 for its own `private-orders-dealer-{orgId}` and 403 for another org's;
    - conversation auth unchanged for a participant (200) and a non-participant (403).

  Run: FAIL.
- [ ] Step 2: Implement; run: PASS. The existing DB suite is still 89/89 plus the new tests.
- [ ] Step 3: Commit `feat(live): order-changed events and live refresh for dashboards`.

### Task 4: Staff Analytics (direction C)

**Files:** Rewrite `src/app/intelligence/retail/page.tsx`, `src/components/retail/retail-analytics-dashboard.tsx` and `retail-analytics.css`. Keep `order-trend-chart.tsx` only if it is reused; otherwise delete it.

- [ ] Step 1: Data. One bounded query each:
  - open orders: status not in final statuses, with `history` `take 1` ordered desc, plus dealer and station;
  - the latest 6 `OrderStatusHistory` rows, with order, dealer, depot and amount;
  - 12 months of orders, with lines, station code, dealer and amount;
  - dealers with their last order date;
  - delivered and released timestamps for this month's cycle times.
- [ ] Step 2: Layout as `analytics-c.html`:
  - Live strip: stage tiles linking to `/intelligence/retail/orders?stage={tab}`, the Stuck top 3 with "See all stuck orders" → `?stage=stuck`, and Happening now;
  - the 4 figures with 12-month sparklines;
  - Litres ordered (12-month lines with a table view);
  - How long orders take;
  - By loading region, Top dealers, Gone quiet;
  - `<LiveRefresh channel={ORDERS_STAFF_CHANNEL} />` in the head.
  - Phone: tiles scroll sideways, figures 2×2, everything else stacks.
- [ ] Step 3: Suites, build, screenshots at 1440/1024/768/390. Commit `feat(staff): live Analytics (direction C)`.

### Task 5: Staff Orders: Stuck tab

**Files:** `src/lib/orders/stages.ts` (`parseStage` accepts `"stuck"`), `src/app/intelligence/retail/orders/page.tsx`.

- [ ] Step 1: Test in `stages.test.ts`: `parseStage("stuck")` → `"stuck"`. Run: FAIL. Implement; run: PASS.
- [ ] Step 2: Add a "Stuck" tab (with count) after Exceptions. The query uses open statuses plus the latest history row, filtered with `stuckOrders`, oldest first. Each row shows a red chip with how long it has waited. Everything else on the list is unchanged.
- [ ] Step 3: Commit `feat(staff): Stuck tab on Orders`.

### Task 6: Staff Home additions

**Files:** `src/app/intelligence/dashboard/page.tsx`, `staff-home.css`.

- [ ] Step 1: Add, as in `homes.html` (staff):
  - the "Today" 4 tiles raised over the photo (`todayFigures`; the dealers-waiting count only with `messaging.view`);
  - "Needs action" rows with "waiting {formatWaited}" and a red chip past the limit;
  - Happening now;
  - EPRA price list (days left from `priceListStatus` / the price table period), Depots today, This month;
  - `LiveRefresh` (staff channel), only when `orders.view`.
- [ ] Step 2: Suites, build, screenshots. Commit `feat(staff): Home with today, needs action, live feed`.

### Task 6b: Staff Member Home and access requests (added 4 Nov)

**Files:**
- Prisma: `AccessRequest` model + migration `2026110412000_access_request`, with fields `id`, `requesterId`, `modules` (JSON string array of PermissionModule), `note?`, `status` (PENDING / GRANTED / DECLINED), `decidedById?`, `decidedAt?`, `createdAt`, and an index on `[status]`.
- Create: `src/lib/users/access-requests.ts` (`requestAccess(user, modules, note)` refuses a second PENDING request and modules outside `PERMISSION_MODULES`; `decideAccess(admin, id, grant)` requires `adminUsers.act` and the request to be PENDING) and its `.db.test.ts`.
- Create: API `POST /api/access-requests`, `PATCH /api/access-requests/[id]`.
- Create: `src/components/staff/access-request-card.tsx`.
- Modify: the staff Home page (the no-Orders branch) and the Admin users page (a pending list with Grant, which opens PermissionsDialog pre-ticked, and Decline).

- [ ] Step 1: DB tests (RED):
  - a Staff Member requests Orders view → PENDING;
  - a second request is refused;
  - an unknown module is refused;
  - a non-admin decides → 403;
  - an admin grants → GRANTED with `decidedById`;
  - an admin declines → DECLINED.
- [ ] Step 2: Migration + service + API; GREEN.
- [ ] Step 3: The Staff Member Home as in `staff-member-home.html`:
  - Note Taker cards from their `NoteSession` rows (next scheduled, notes READY, the latest 4 sessions);
  - presentations (the latest 2);
  - prices;
  - Today at Trinity counts (`todayFigures` without money);
  - the price list;
  - the access card;
  - `LiveRefresh` on a new `private-orders-count` channel, open to any staff and carrying counts only. Or reuse the staff channel only for `orders.view`, with the counts refreshed by the 60 s fallback for others; decide in the ledger.
- [ ] Step 4: Suites, build, screenshots for staff.mvz7aoei@stress.test (no permissions). Commit `feat(staff): Staff Member Home with meetings, prices, today, access requests`. Tell Adrian the migration name.

### Task 7: Dealer Home additions

**Files:** `src/app/dealer/(portal)/dashboard/page.tsx`, `dashboard.css`; create `src/components/dealer/order-tracker-mini.tsx` (reuses `dealerTrackerSteps`).

- [ ] Step 1: Add, as in `homes.html` (dealer):
  - 3 cards raised over the photo: To pay (`toPay`), On the way (`onTheWay`), This month;
  - "Where it is now": the tracker with depot, truck and driver, plus "+ N more on the way" linking to `/dealer/orders?view=deliveries`; hidden when nothing is on the way;
  - Fuel ordered (existing);
  - Today's prices with the 10,000 L PMS cost (`orderEstimate`);
  - Orders (latest 3) and Messages (latest 2 from Trinity, with unread count; reuse the messaging service);
  - `LiveRefresh` on the dealer's own channel.
- [ ] Step 2: Suites, build, screenshots. Commit `feat(dealer): Home with to-pay, live tracker, prices, messages`.

### Task 8: Checks, live proof, review

- [ ] Step 1: Rebuild the browser-check tooling in the scratchpad: `playwright-core@1.46.1`, plus the Chromium libs via `apt-get download` + `dpkg -x` (no sudo), as on 2 Nov.
- [ ] Step 2: Check script: the three pages at 1440/1280/1024/768/390, checking for sideways scroll, chart text ≥ 12.5px, one `h1`, no small all-caps, and no action buttons for viewonly / noaccess.
- [ ] Step 3: Live proof:
  - Open staff Analytics and the dealer Home.
  - Move a tri_stress order through `confirmPayment` (a script calling the service, with Odoo and email keys blank).
  - Expect the stage tile and the feed to update within 70 s, with the Pusher keys blank (the fallback).
  - Note in the ledger whether real-time push was tested (it is only if Pusher keys exist locally).
- [ ] Step 4: Unit, DB, tsc, eslint, build. Then the final review of this plan's commits, the fixes, and the deferred minors listed for Adrian.
