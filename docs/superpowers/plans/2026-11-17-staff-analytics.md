# Staff Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old dark Analytics page with direction C inside the light staff shell, every number from portal orders, refreshing every minute.

**Architecture:** Pure functions in `src/lib/insights/` turn plain order rows + `now` into each block's data; one loader in the same folder fetches the rows with bounded Prisma queries; a server page under `(home)` renders the blocks with plain SVG; a tiny client component refreshes the route every 60 s.

**Tech Stack:** Next.js 15 app router (server components), Prisma/Postgres, plain CSS, node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-11-17-staff-analytics-design.md` · **Mockup:** `D:\Downloads\analytics-mockup-2026-11-17.html` (template in scratchpad `analytics-mock/template.html`)

## Global Constraints

- Route `/intelligence/retail/analytics`; `canUser(user, "analytics", "view")` else `redirect("/intelligence/dashboard")`.
- Nairobi calendar for months/"this month" (`nairobiMonthStart`); "ago" texts from `now`.
- Figures 3–6 exclude `DRAFT`, `CANCELLED`, `REJECTED`. Stage tiles count open orders only: stages `quotation, awaiting-payment, checking-payment, payment-confirmed, depot, transit` from `ORDER_STAGES`.
- Value incl. VAT = sum of `Number(amountDue)` for orders created this month with `amountDue` set.
- Stuck limits (hours): SUBMITTED/ODOO_SYNC_PENDING/QUOTATION_CREATING 2; QUOTATION_READY/PFI_PENDING 4; PFI_ISSUED/AWAITING_PAYMENT 48; PAYMENT_SUBMITTED/PAYMENT_VERIFICATION 24; PAYMENT_CONFIRMED 8; RELEASED_TO_DEPOT/LOADING/LOADED 24; DISPATCHED/IN_TRANSIT 48. Entered-at = latest history row with `toStatus` = current status, else `updatedAt`.
- Colours: PMS `#3853a4`, AGO `#1a9fb2`, yellow `#ffcc00` only for busiest/slowest. Text ≥ 12px. No new dependencies.
- Faint text uses `var(--tri-text-faint, <hex>)` only if hex < 5:1 (accessibility branch convention); prefer AA greys (`#5b6b8c`) so nothing is needed.
- New unit/DB test files are added to `package.json` `"test"` / `"test:db"`.
- **Ruling (spec §2.6):** "By loading depot" groups by the station's loading warehouse (`fulfillmentForStation(code)?.warehouseName`, e.g. "Lake Oil Nairobi", "KPC Nakuru"), not `DealerOrder.depotId` — `depotId` is only set at release, so most orders would show as "not released". Stations without a mapping → "Other".

## Review Focus

1. A month with zero orders (fresh DB, new month at 00:00 Nairobi) → every block shows its plain empty state, no `NaN`, `Infinity` or "▲ Infinity%" (pct change from 0 → shown as "new", not a percent).
2. Orders with no `amountDue` yet (quotation pending) → counted in orders/litres, skipped in value.
3. History rows missing for a status (old orders created before history existed) → stuck uses `updatedAt`, cycle-time pairs skipped.
4. A user without `analytics.view` → redirected; the loader is never called.
5. 390 px phone → no sideways page scroll; stage tiles scroll inside their row.

Pinned by: 1 → Task 2 + Task 4; 2 → Task 2; 3 → Task 1 + Task 2; 4 → Task 5; 5 → Task 6.

---

### Task 1: Stages, stuck and events

**Files:** Create `src/lib/insights/live.ts`; Test `src/lib/insights/live.test.ts`

**Interfaces — Produces:**
- `type InsightOrder = { id: string; reference: string; status: DealerOrderStatus; createdAt: Date; updatedAt: Date; dealerName: string; stationName: string; stationCode: string | null; amountDue: string | null; lines: { product: string; quantityLitres: number }[] }`
- `type InsightHistory = { orderId: string; toStatus: string; createdAt: Date }`
- `stageCounts(orders: InsightOrder[]): { key: StageKey; label: string; count: number; busiest: boolean }[]` — the six open stages in `ORDER_STAGES` order; `busiest` on the highest count (first on ties; none when all 0).
- `STUCK_LIMIT_HOURS: Partial<Record<DealerOrderStatus, number>>`
- `stuckOrders(orders, history: InsightHistory[], now: Date): { id, reference, dealerName, stageLabel, waitedMs, limitHours }[]` — over-limit only, largest overrun first.
- `eventText(e: { toStatus: string; reference: string; dealerName: string; stationName: string; depotName?: string | null }): string` — wording from spec §4; fallback `"{ref}: {statusLabel}"`.
- `formatWait(ms: number): string` — "3 h 20 m", "5 d 2 h", "45 m".
- `timeAgo(at: Date, now: Date): string` — "just now", "12 min ago", "3 h ago", "2 d ago".

- [ ] **Step 1: Write failing tests:** tiles sum only open statuses (a DELIVERED and a CANCELLED order are not counted); busiest = Awaiting Payment for {3,14,2,1,2,1}; no busiest when all zero; each limit at exactly the limit → not stuck, +1 minute → stuck (loop over `STUCK_LIMIT_HOURS`); unknown status never stuck; entered-at uses the latest matching history row and falls back to `updatedAt`; ordering by overrun; `eventText` for SUBMITTED, PFI_ISSUED, PAYMENT_SUBMITTED, PAYMENT_CONFIRMED, RELEASED_TO_DEPOT, DISPATCHED, DELIVERED and fallback; `formatWait(12_000_000)` = "3 h 20 m", `formatWait(440_000_000)` = "5 d 2 h"; `timeAgo` boundaries (59 s → "just now", 60 s → "1 min ago", 90 min → "1 h ago", 49 h → "2 d ago").
- [ ] **Step 2: Run** `node --import tsx --test src/lib/insights/live.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `live.ts`.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(analytics): stage counts, stuck orders and event wording`.

### Task 2: Figures, monthly series and cycle times

**Files:** Create `src/lib/insights/figures.ts`; Test `src/lib/insights/figures.test.ts`

**Interfaces — Consumes:** `InsightOrder`, `InsightHistory` (Task 1). **Produces:**
- `monthFigures(orders, now): { litres: Pair; value: Pair; orders: Pair; activeDealers: Pair; totalDealers: number }` where `Pair = { now: number; prev: number; change: number | null }` (`change` = % rounded to 1 dp, `null` when `prev` is 0).
- `monthlyLitres(orders, now, months = 12): { key: string; label: string; pms: number; ago: number }[]` — oldest first, Nairobi months (reuse `lastNMonthLabels` / `monthKey` from `src/lib/retail/analytics.ts`).
- `cycleTimes(history, now): { label: string; medianMs: number | null; slowest: boolean }[]` — the four steps (SUBMITTED→PFI_ISSUED, PFI_ISSUED→PAYMENT_CONFIRMED, PAYMENT_CONFIRMED→RELEASED_TO_DEPOT, RELEASED_TO_DEPOT→DELIVERED), pairs whose end falls in this Nairobi month; `median` of odd/even counts; `slowest` on the max non-null.

- [ ] **Step 1: Failing tests:** excluded statuses not counted; `value` skips null/empty `amountDue` and parses "1066500.00"; `change` null when prev 0, `-50` for 2→1; active dealers counts distinct dealers this month; month edge: an order at 2026-10-31T21:30Z belongs to November (Nairobi); `monthlyLitres` 12 entries ending with the current month, PMS/AGO split; median of [1,3,2]=2 and [1,2,3,4]=2.5 h; a step with no pairs → `null`, not slowest; an order missing the start row is skipped.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** `feat(analytics): month figures, monthly litres and cycle times`.

### Task 3: Warehouses and dealers

**Files:** Create `src/lib/insights/dealers.ts`; Test `src/lib/insights/dealers.test.ts`

**Interfaces — Produces:**
- `litresByWarehouse(orders, now): { name: string; litres: number; prevLitres: number }[]` — this month and last month per `fulfillmentForStation(stationCode)?.warehouseName ?? "Other"`, sorted by litres desc.
- `topDealers(orders, now, n = 5): { name: string; litres: number }[]`
- `goneQuiet(lastOrderByDealer: { name: string; lastOrderAt: Date }[], now, days = 30, max = 8): { name: string; days: number }[]` — strictly more than 30 days → included at 31; exactly 30 → not; oldest first.

- [ ] **Steps 1–5** as above (tests: grouping incl. an unmapped station → "Other"; prev-month litres; top 5 order and cut; gone-quiet boundary 30/31 days, max 8). Commit `feat(analytics): litres by loading warehouse, top dealers, gone quiet`.

### Task 4: Loader

**Files:** Create `src/lib/insights/load.ts`; Test `src/lib/insights/load.db.test.ts` (add to `"test:db"`)

**Interfaces — Consumes:** Tasks 1–3. **Produces:** `loadAnalytics(now = new Date()): Promise<AnalyticsData>` where `AnalyticsData` holds every block's output plus `updatedAt: Date`.

- [ ] **Step 1: Failing DB test** (tri_test, own org/station/users, cleaned up in `after`): two orders this month (one with lines 10,000 PMS + 5,000 AGO and `amountDue` "1000.00", one SUBMITTED with no amount), one CANCELLED, one last month; history rows for one order; assert litres 15,000 (cancelled excluded), value 1000, orders 2, stage tile counts, the SUBMITTED order stuck when `now` is 3 h after its history row, latest events length ≤ 6 and newest first. Empty-month case: `now` in a month with no orders → figures 0, `change` null, stuck `[]`.
- [ ] **Step 2: Run** `npm run test:db` filtered to the file — FAIL. **Step 3: Implement** with two query waves (orders since 12 months ago incl. lines/dealer/station; open orders' latest history + latest 6 history rows incl. order ref/dealer/station/depot; last order per dealer via `groupBy` on `dealerOrganizationId` `_max: { createdAt }` + names). **Step 4:** PASS. **Step 5: Commit** `feat(analytics): data loader`.

### Task 5: Page, components and clean-up

**Files:**
- Create `src/app/intelligence/retail/(home)/analytics/page.tsx` (server; permission check before loading), `src/components/staff/staff-analytics.tsx` (server-safe render of the blocks), `src/components/staff/analytics-auto-refresh.tsx` (`"use client"`; `router.refresh()` every 60 s while visible + on `visibilitychange` to visible), `src/components/staff/analytics-litres-chart.tsx` (`"use client"`; SVG lines + "View as table" toggle), `src/app/intelligence/retail/staff-analytics.css`.
- Delete `src/app/intelligence/retail/(workspace)/` (layout + analytics page), `src/components/retail/retail-analytics-dashboard.tsx`, `src/app/intelligence/retail/retail-analytics.css`, and `src/components/retail/retail-shell.tsx` if nothing else imports it.
- Keep `src/lib/retail/analytics.ts` (messaging context + tests use it).

- [ ] **Step 1:** Build from the mockup's structure and CSS (hero uses the shared `so-hero` plate classes from `staff-portal-hero.css`; cards overlap the hero like Support). Empty states: "No orders yet this month", "Nothing stuck right now", "No order activity yet", "No dealer has gone quiet". Change badge: `▲ 12.4%`, `▼ 50%`, or "new" when `change` is null and now > 0, "—" when both 0.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm test`, `npx next build` (catches the route-group move; `rm -rf .next/types` first).
- [ ] **Step 3: Commit** `feat(analytics): direction C page in the staff shell; remove the old dark page`.

### Task 6: Browser checks, suites, review

- [ ] **Step 1:** Stress build (tri_stress, mock Odoo, blank email key), staff admin login: widths 1440/1280/1024/768/390 — no sideways scroll, one `h1`, no text < 12px except the shared header badge, stage tiles scroll on phone; screenshot each and compare against the mockup screenshots.
- [ ] **Step 2:** A Staff Member without `analytics.view` → redirected (DB login via throwaway user, or `canUser` unit already covers; check the route returns a redirect).
- [ ] **Step 3:** Refresh: change an order's status in tri_stress through the service, open page updates within 70 s.
- [ ] **Step 4:** `npm test`, `npm run test:db`, `tsc`, `next build`; final review (self-review unless Adrian asks for a reviewer agent); PR text `D:\Downloads\pr-staff-analytics.md` (no attribution lines); device screenshots PDF for Adrian.
