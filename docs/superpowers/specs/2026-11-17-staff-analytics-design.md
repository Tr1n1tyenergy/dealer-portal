# Staff Analytics (direction C) — design

**Status:** approved in chat by Adrian (16 Nov 2026): build all of direction C from the 3 Nov brainstorm, with a 1-minute refresh instead of Pusher and no separate Stuck tab. Branch `feat/staff-analytics`, its own PR.
**Source design:** `.superpowers/brainstorm/2581-1793714229/content/analytics-c.html` and spec `2026-11-03-live-dashboards-design.md` §3.1 (on `feat/portal-redesign`). This document replaces §3.1 for the build.
**Out of scope:** Pusher push events, a Stuck tab on Orders, staff/dealer Home changes, money other than quoted order values, new data entry.

## 1. Where it lives

- Route stays `/intelligence/retail/analytics`, needs `canUser(user, "analytics", "view")` (else redirect, as today).
- The page moves from `(workspace)` (old dark `RetailShell`) into `(home)` (the light `StaffPortalShell`), under the same sunset hero as Orders and Support. Analytics is the last page in `(workspace)`, so that route group and its layout are deleted (and `RetailShell` too if nothing else uses it).
- The old `retail-analytics-dashboard.tsx` and `retail-analytics.css` are deleted once nothing imports them; helpers in `src/lib/retail/analytics.ts` that the new page still uses (`pctChange`, `monthKey`, `lastNMonthLabels`, `sparklinePath`) stay.

## 2. Blocks, top to bottom

1. **Hero:** eyebrow "Analytics", title "How the business is doing", one line "Orders, litres and dealers across all stations — updates every minute." Badge on the right: "Updated hh:mm" (Nairobi time of the server render).
2. **Live strip** (one card, three columns on desktop, stacked on phones):
   - **Orders by stage:** six tiles from `ORDER_STAGES` in `src/lib/orders/stages.ts` — Quotation & PFI, Awaiting Payment, Checking Payment, Payment Confirmed, At Depot, In Transit — each with its count of open orders. The tile with the highest count is yellow (ties: the earlier stage). Each tile links to `/intelligence/retail/orders?stage=<key>`. On phones the tiles scroll sideways.
   - **Stuck:** the 3 orders furthest over their limit (largest overrun first), each showing reference, dealer, stage label and "waiting 3 h 20 m (limit 2 h)", linking to Order Details. Under them, "+N more stuck" when there are more (plain text, no link). Empty: "Nothing stuck right now".
   - **Happening now:** the latest 6 `OrderStatusHistory` rows, worded per status (§4), with "12 min ago". Empty: "No order activity yet".
3. **Four figures** (this Nairobi month vs last month, change as ▲/▼ %, plus a 12-month sparkline):
   - Litres ordered (sum of order lines, PMS + AGO).
   - Value incl. VAT (sum of `amountDue` of orders with a quotation this month). `amountDue` is the quotation total at the dealer's own price (`dealerUnitPriceForStation`, margins included) plus 8% VAT, so no extra margin maths is needed.
   - Orders placed.
   - Active dealers (organisations with at least one order this month).
4. **Litres ordered, 12 months:** two lines, PMS (blue) and AGO (teal), monthly. "View as table" toggle shows the same numbers.
5. **How long orders take:** median this month, in hours or days, for Order → PFI issued, PFI issued → payment confirmed, Payment confirmed → released to depot, Released → delivered. The slowest step is yellow. A step with no completed pairs shows "—".
6. **Bottom row:**
   - **By loading depot:** litres this month per `Depot` (whatever depots exist — no hard-coded list), with a small marker for last month.
   - **Top 5 dealers:** by litres this month.
   - **Gone quiet:** dealers with at least one order ever and none in the last 30 days, oldest last-order first, max 8, with "last order 41 days ago".

Every number comes from portal data. "Orders" counts exclude `DRAFT` and `CANCELLED`/`REJECTED` for figures 3–6; stage tiles count open orders only (not `complete`, not `exceptions`).

## 3. Stuck limits (Adrian, 3 Nov)

Measured from when the order entered its current status (latest `OrderStatusHistory.createdAt` with `toStatus` = current status; fall back to `updatedAt`):

| Statuses | Limit |
|---|---|
| SUBMITTED, ODOO_SYNC_PENDING, QUOTATION_CREATING | 2 h |
| QUOTATION_READY, PFI_PENDING | 4 h |
| PFI_ISSUED, AWAITING_PAYMENT | 48 h |
| PAYMENT_SUBMITTED, PAYMENT_VERIFICATION | 24 h |
| PAYMENT_CONFIRMED | 8 h |
| RELEASED_TO_DEPOT, LOADING, LOADED | 24 h |
| DISPATCHED, IN_TRANSIT | 48 h |

Other statuses are never stuck.

## 4. How it works

- **Pure functions first,** in `src/lib/insights/` (one file per block: `stages.ts`, `stuck.ts`, `events.ts`, `figures.ts`, `cycle-times.ts`, `depots.ts`, `dealers.ts`). Each takes plain rows and `now`, returns plain data. Nairobi month edges reuse `src/lib/time/nairobi.ts`.
- **Event wording** per `toStatus`, e.g. SUBMITTED → "{dealer} placed {ref}", PFI_ISSUED → "PFI issued for {ref}", PAYMENT_SUBMITTED → "{dealer} submitted payment for {ref}", PAYMENT_CONFIRMED → "Payment confirmed for {ref}", RELEASED_TO_DEPOT → "{ref} released to {depot}", DISPATCHED → "{ref} left the depot", DELIVERED → "{ref} delivered to {station}"; anything else → "{ref}: {statusLabel}".
- **Queries:** the page loads rows with Prisma in two waves (the existing page's pool-limit note still applies): orders + lines + dealer + station + depot for the last 12 months; open orders with their latest history row; the latest 6 history rows; last order date per dealer. All bounded by date or `take`.
- **Refresh:** a small client component `AutoRefresh` calls `router.refresh()` every 60 s while `document.visibilityState === "visible"`, and once when the tab becomes visible again.
- **Charts:** plain inline SVG sized to its container (viewBox + CSS width 100%), no new library; axis text 13px or more; every chart has a table view. Colours: PMS blue `#3853a4`, AGO teal `#2cc0d2`, yellow `#ffca06` only for "busiest"/"slowest".
- **Styling:** new `staff-analytics.css` following `staff-orders.css` patterns (hero, cards, tokens). Uses the faint-text variables from the accessibility branch if it has merged first; otherwise plain AA-passing greys (no `#94a3b8` for text).

## 5. Testing

- **Unit tests first** for every `src/lib/insights` function: each stuck limit at and just over the limit, and an unknown status; medians with odd/even counts and no data; Nairobi month edges (UTC 21:00 on the last day); active dealers; gone-quiet boundary at exactly 30 days; event wording for each listed status and the fallback; depot grouping with an order that has no depot.
- **DB test:** the page's data loader against `tri_test` with a few seeded orders returns the expected figures.
- **Browser checks** on the stress build: 390, 768, 1024, 1280, 1440 — no sideways page scroll, one `h1`, text ≥ 13px, tiles scroll on phones; a user without `analytics.view` is redirected.
- `npm test`, `npm run test:db`, `tsc`, `next build` before claiming done.

## 6. Acceptance

- Matches direction C's layout inside the new staff shell and hero.
- Every figure traces to portal data; empty states read plainly.
- The page updates within about a minute without a reload.
