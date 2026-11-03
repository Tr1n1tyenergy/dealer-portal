# Portal redesign step 2 (dealer portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dealer page after the dashboard (Orders, PFIs, order page, Place an order, Messages, Support) in the E2 style: light ground, page title + one line + main action, clean lists, shared chips and buttons, nothing made up.

**Architecture:** One shared page pattern (`PageHead` + `.ui-page` column) on the light ground; each page keeps its data loading and behaviour and gets new markup and a rewritten CSS file built only from the step-1 tokens and `ui.css` controls. Old dealer CSS is deleted as pages move over. One new piece of logic: the live order estimate on Place an order.

**Tech Stack:** Next.js 15 app router, React 19, hand-written CSS with `--tri-*` tokens, node:test via tsx, Playwright-core browser checks.

**Spec:** `docs/superpowers/specs/2026-11-02-portal-redesign-design.md` (§3 foundation, §6 working pages, §7, §8 step 2)

## Global Constraints

- Branch `feat/portal-redesign-dealer`, cut from `feat/portal-redesign` (step 1, e3bc423). Nothing is pushed until steps 2–4 are all built (Adrian, 3 Nov). No attribution lines in commits.
- Behaviour unchanged: same queries, same server actions, same links and query strings (`?view=`, `?q=`, `?submitted=`). Every existing unit and DB test stays green.
- Colours, radii, font only from `--tri-*` tokens and `ui.css` classes (`ui-btn--primary|secondary|quiet|destructive`, `ui-chip--*` via `StatusChip`, `ui-tabs`, `ui-navlink`, `EmptyState`/`Skeleton`/`ErrorState`). No new colour values except inside `globals.css`.
- Yellow is the one main action per screen. Sentence case; no small all-caps labels; body text 16px, small 13px minimum; tabular figures for numbers and amounts.
- No sideways scroll at 390px; tabs scroll sideways in one row instead of wrapping; on phones list rows stack (no sideways-scrolling tables).
- No made-up content: drop the stock station thumbnail, the "Active" / "Active Station" dot and the `stationArea()` "Kenya" guess.
- UI work follows the redesign-skill (taste family, app screens), brand gradient kept for progress bars only.
- Test commands: `npm test` (unit), `env -u DATABASE_URL RESEND_API_KEY="" npm run test:db` (DB, uses `.env.test.local`), browser checks against a production build on `tri_stress` served on :3996.

## Review Focus

1. Long station or company names (e.g. "PLACEHOLDER DEALER — OUTSPAN ELDORET") in order rows, the order page head and Place an order at 390px: text wraps or truncates; the page never scrolls sideways.
2. Orders with only one fuel (PMS only or AGO only): rows, order page and estimate show just that fuel, never "0 L" or "—" pairs.
3. A station with no code or no EPRA region: Place an order shows "The amount will be on your PFI." instead of a price; no NaN or KES 0.00.
4. Orders in exception or stopped states (PAYMENT_EXCEPTION, DELIVERY_EXCEPTION, CANCELLED, REJECTED): the tracker shows the attention/stopped state in red/grey with its sentence, and the payment form appears for PAYMENT_EXCEPTION.
5. Keyboard on the light ground: tabs, order rows, Support, the Place-order steps and payment-form errors all reachable with a visible focus ring.

Lines 1, 2 and 4 are pinned by the Task 1 browser check visiting every order of the long-name dealer at 390px; line 3 by the Task 4 unit test; line 5 by the Task 6 keyboard pass.

---

### Task 1: Page pattern, light ground and the step-2 browser check

**Files:**
- Create: `src/components/layout/page-head.tsx`
- Modify: `src/components/ui/ui.css` (append `.ui-page`, `.ui-page-head`; make `.ui-tabs` one scrolling row)
- Modify: `src/app/dealer/dealer-portal.css` (`.dp-content` background → `var(--tri-ground)`, drop `#0a192f !important`)
- Create (scratch, not in repo): `scratchpad/pw/dealer-step2-check.cjs`

**Interfaces:**
- Produces: `PageHead({ title: string; description?: string; action?: ReactNode; back?: { href: string; label: string } })` → `<header className="ui-page-head">` with optional back link (quiet, "← {label}"), `<h1>`, `<p>`, action on the right (below on phones). `.ui-page` = centred column, `max-width: 1280px`, padding 24px (16px under 768px).
- Produces: `dealer-step2-check.cjs` — signs in as `dealer.outspan@…` (long name) and `dealer.pery@…`, visits `/dealer/orders`, every `?view=` tab, every order page of the dealer, `/dealer/orders/new`, `/dealer/messaging` at 1440/768/390; fails on: page sideways scroll > 1px; `.dp-content` computed background not `rgb(249, 250, 251)`; not exactly one `h1`; a `.ui-tabs` taller than one row; any element with computed `text-transform: uppercase` and font-size < 14px inside `.dp-content`; page errors. Saves screenshots to `pw/shots-step2/`.

- [ ] **Step 1:** Write `dealer-step2-check.cjs` (reuse the sign-in and launch code of `review-fixes-check.cjs`).
- [ ] **Step 2:** Run it against the current build. Expected: FAIL — dark `.dp-content` on every page, uppercase small labels, several `h1` counts off.
- [ ] **Step 3:** Implement `PageHead`, the `.ui-page*` rules and the light `.dp-content`.
- [ ] **Step 4:** `npx tsc --noEmit` and `npx eslint src`. Expected: clean. (The check stays red until Tasks 2–5 move the pages.)
- [ ] **Step 5:** Commit `feat(dealer): shared page head and light ground`.

### Task 2: Orders list and the PFIs tab

**Files:**
- Modify: `src/lib/orders/dealer-views.ts` — `RecentOrderRow.tone: string` → `status: DealerOrderStatus`; delete the local `statusTone()`.
- Modify: `src/lib/orders/dealer-views.test.ts:98`
- Modify: `src/components/dealer/recent-orders.tsx` (same name and props; new markup)
- Rewrite: `src/components/dealer/recent-orders.css`
- Modify: `src/app/dealer/(portal)/orders/page.tsx`

**Interfaces:**
- Consumes: `PageHead`, `StatusChip({ status, label })`, `EmptyState`, `.ui-tabs`.
- Produces: `RecentOrderRow = { id; reference; stationName; createdAt; updatedAt; statusLabel; status: DealerOrderStatus; pms: number | null; ago: number | null; hasPfi }`.

- [ ] **Step 1: Failing test** — in the existing `toDealerOrderRow` test replace `assert.equal(row.tone, "payment")` with `assert.equal(row.status, "AWAITING_PAYMENT")`.
- [ ] **Step 2:** `npm test`. Expected: FAIL on that assertion (`undefined !== "AWAITING_PAYMENT"`).
- [ ] **Step 3:** Change the row type and `toDealerOrderRow`; remove `statusTone`.
- [ ] **Step 4:** `npm test`. Expected: PASS, 225/225.
- [ ] **Step 5:** Orders page: `PageHead title="Orders" description="Every fuel order from submission to delivery."` (no action — the header carries Place an order); remove the dp-hero section. `totalOrders === 0` → `EmptyState` with the dashboard's copy "No orders yet. Place your first order and we'll prepare the quotation and PFI for you." and a primary Place an order button.
- [ ] **Step 6:** `RecentOrders` markup: tabs (`ui-tabs`, `aria-current` kept), one filter row (search input, status select, station select — labels kept for screen readers), then a `<ul>` of rows. Each row is one link to `/dealer/orders/{id}` laid out as: reference (bold) + date (soft) · station · fuel ("PMS 3,000 L · AGO 2,000 L", only the fuels present) · `StatusChip` · updated ("2 hours ago", full date in `title`). "View PFI" is a separate quiet link after the row link when `hasPfi` (not nested inside it). Desktop: grid columns `1fr 1.2fr 1.3fr auto auto`; under 768px the row stacks: reference + chip on line 1, station on line 2, fuel + updated on line 3, View PFI below. Empty filter result: "No orders match your filters." / per-tab `emptyMessage` as today. Remove the thumbnail and the "Active" dot.
- [ ] **Step 7:** `npx tsc --noEmit`, `npx eslint src`, `npm test`. Expected: clean, 225/225.
- [ ] **Step 8:** Commit `feat(dealer): Orders and PFIs list in the E2 style`.

### Task 3: Order page (tracker, details, documents, payment form)

**Files:**
- Modify: `src/app/dealer/(portal)/orders/[id]/page.tsx`
- Modify: `src/components/dealer/payment-form.tsx` (markup and classes only)
- Rewrite: `src/components/dealer/order-tracking.css`, `src/components/dealer/order-tracking-nav.css`

**Interfaces:**
- Consumes: `PageHead` (`back={{ href: "/dealer/orders", label: "Orders" }}`), `StatusChip`, `dealerTrackerSteps`, `OrderTrackingNav` (unchanged props), `PaymentForm({ orderId, amountDue })` (unchanged props).

- [ ] **Step 1:** Head: `PageHead title={order.reference}` with `description` = "{station} · {total litres} · submitted {date}", the `StatusChip` beside the title, `OrderTrackingNav` as the action. Under it one sentence: `statusCopy(order.status).detail`.
- [ ] **Step 2:** Tracker: same `tracker.steps` data and `aria-current="step"`; a white panel with 7 steps in a row on ≥768px (dot + label + note; done = blue dot with tick, active = yellow ring, attention = red "!", pending = grey, connector between done steps in brand gradient); under 768px a vertical list. `tracker.stopped` sentence above the steps in the problem colour.
- [ ] **Step 3:** Body grid `2fr 1fr` (one column under 900px): "Order details" as a definition list (PMS, AGO — only present fuels — total, station, requested delivery, order date, your reference "Not provided", notes "None") — no icons-in-boxes, no `stationArea()`. Side: "Documents" list (title + chip; `docState` tones map ready → `ui-chip--done`, processing → `ui-chip--trinity`, "Action needed" → `ui-chip--dealer`, pending → `ui-chip--muted`; PFI row links to `/api/orders/{id}/pfi` with "View PFI"). Then `PaymentForm` when `canPay`.
- [ ] **Step 4:** `PaymentForm`: label above each input, error under the amount (`role="alert"`, `aria-describedby` kept), `ui-btn ui-btn--primary` submit, inputs 48px tall, 16px text.
- [ ] **Step 5:** `npx tsc --noEmit`, `npx eslint src`, `npm test`. Expected: clean, 225/225.
- [ ] **Step 6:** Commit `feat(dealer): order page in the E2 style`.

### Task 4: Place an order (AGO starts at 0, live amount incl. VAT)

**Files:**
- Create: `src/lib/orders/order-estimate.ts`, `src/lib/orders/order-estimate.test.ts` (add to the `test` list in `package.json`)
- Modify: `src/app/dealer/(portal)/orders/new/page.tsx` (select `code`; pass prices)
- Modify: `src/components/dealer/place-order-form.tsx`
- Rewrite: `src/components/dealer/place-order.css`

**Interfaces:**
- Consumes: `pfiTotals(lines, vatRate?)`, `PFI_VAT_RATE`, `formatMoney`, `epraUnitPriceForStation(code, product): number | null`.
- Produces: `orderEstimate(litres: { pms: number; ago: number }, prices: { pms: number; ago: number } | null): PfiTotals | null` — null when prices are null or both quantities are 0; lines only for fuels with litres > 0; unit price passed as `toFixed(2)` strings.
- Produces: page passes `stations: { id: string; name: string; prices: { pms: number; ago: number } | null }[]` (null when the code is missing or either price is null).

- [ ] **Step 1: Failing tests** in `order-estimate.test.ts`:

```ts
test("adds 8% VAT on top of the EPRA price", () => {
  const e = orderEstimate({ pms: 1000, ago: 0 }, { pms: 226.51, ago: 227.71 })!;
  assert.deepEqual([e.subtotal, e.vat, e.total], ["226510.00", "18120.80", "244630.80"]);
  assert.deepEqual(e.lines.map((l) => l.product), ["PMS"]);
});
test("both fuels", () => {
  const e = orderEstimate({ pms: 3000, ago: 2000 }, { pms: 226.51, ago: 227.71 })!;
  assert.equal(e.subtotal, "1134950.00");
  assert.equal(e.total, "1225746.00");
});
test("no prices for the station → no estimate", () => {
  assert.equal(orderEstimate({ pms: 1000, ago: 0 }, null), null);
});
test("nothing ordered → no estimate", () => {
  assert.equal(orderEstimate({ pms: 0, ago: 0 }, { pms: 226.51, ago: 227.71 }), null);
});
```

(1,225,746.00 matches DO-2026-000014's PFI on tri_stress, PMS 3,000 + AGO 2,000.)
- [ ] **Step 2:** `npm test`. Expected: FAIL — cannot find module `./order-estimate`.
- [ ] **Step 3:** Implement `orderEstimate` with `pfiTotals`.
- [ ] **Step 4:** `npm test`. Expected: PASS, 229/229.
- [ ] **Step 5:** Form: `useState(0)` for AGO (PMS keeps 20,000). Same wizard (details → review → submit), same `placeOrderAction`, hidden fields and `submissionKey`. `PageHead title="Place an order"` with the step's copy as description and a quiet "Need help?" that calls `openSupport()`; the three steps as a numbered row (current step blue + underlined, done ticked). Station as a plain select with label; delivery date input with helper "Up to {max} (current EPRA prices)"; PMS and AGO quantity fields with − / + and the quick amounts as secondary pill buttons. Summary panel (sticky on desktop, below on phones): station, delivery date, each fuel's litres, total litres, then "Estimated amount (incl. 8% VAT)" = `KES {formatMoney(total)}` with subtotal and VAT lines, small note "The final amount is on your PFI." — or, when `orderEstimate` is null and litres > 0, "The amount will be on your PFI." The one primary button: "Review order" / "Submit order". "What happens next" becomes a plain numbered list of the five steps. Remove the dark hero and stock station thumbnail.
- [ ] **Step 6:** `npx tsc --noEmit`, `npx eslint src`, `npm test`, DB tests. Expected: clean, 229/229, 89/89.
- [ ] **Step 7:** Commit `feat(dealer): Place an order in the E2 style, AGO starts at 0, live amount`.

### Task 5: Messages (light, shared with staff)

**Files:**
- Rewrite colour rules in: `src/components/messaging/messaging.css` (markup in `messaging-app.tsx` unchanged)
- Modify: `src/app/dealer/(portal)/messaging/page.tsx` (`PageHead title="Messages" description="Conversations with the Trinity team."`, drop its hero)

**Interfaces:**
- Consumes: tokens only. `--msg-*` custom properties re-pointed: canvas → `--tri-ground`, card/glass → `--tri-surface`, ink → `--tri-ink`, muted → `--tri-soft`, line/card-border → `--tri-line`, mine → `--tri-blue` (white text), theirs → `#eef2fb`, gold → `--tri-yellow`, royal/tick → `--tri-blue`. Every hard-coded dark colour (`#0a192f`, `#122a4a`, `#1a3358`, dark rgba glass) replaced by a token; "New chat" uses `ui-btn--primary`; All/Unread filter uses the `ui-tabs` look.

- [ ] **Step 1:** Re-point the variables and replace hard-coded colours; keep the existing ≤980px one-pane-at-a-time rules.
- [ ] **Step 2:** `grep -E "#0a192f|#122a4a|#1a3358" src/components/messaging/messaging.css`. Expected: no output.
- [ ] **Step 3:** Build, then open `/dealer/messaging` and `/intelligence/retail/messaging` at 1440 and 390, open a conversation, send nothing. Expected: light panels, readable bubbles (contrast AA), phone shows list → chat → back.
- [ ] **Step 4:** Commit `feat(messaging): light E2 style for dealer and staff`.

### Task 6: Support card, dead CSS, full check, screenshots

**Files:**
- Modify: `src/components/dealer/support-card.tsx` (classes only) and its CSS rules
- Modify: `src/app/dealer/dealer-portal.css` (delete every `dp-*` rule no `.tsx` uses any more; keep the depot `.portal*` rules for step 4)
- Create (outside repo): `D:\Downloads\portal-redesign-step2-screens\`, `D:\Downloads\pr-portal-redesign-step2.md`

- [ ] **Step 1:** Support card: white panel, 16px radius, title + quiet Close, links in brand blue; backdrop `rgba(24,33,58,.4)`. Focus trap and opener return unchanged.
- [ ] **Step 2:** Prune `dealer-portal.css` with the step-1 prune script (`scratchpad/prune_css.py`, BEM-safe pattern); grep every removed class against `src/**/*.tsx` → no hits.
- [ ] **Step 3:** Build on tri_stress, serve :3996, run `dealer-step2-check.cjs` and `review-fixes-check.cjs`. Expected: "no problems" from both.
- [ ] **Step 4:** Keyboard pass at 1440: Tab through Orders (tabs, filters, rows), an order page (payment form with a bad amount → error read out), Place an order (all steps), Support. Expected: every stop has a visible ring; nothing unreachable.
- [ ] **Step 5:** Unit, DB, tsc, eslint, build. Expected: all green.
- [ ] **Step 6:** Copy before (`shots-rd`) and after (`shots-step2`) screenshots to `D:\Downloads\portal-redesign-step2-screens\`; write the PR text.
- [ ] **Step 7:** Commit `chore(dealer): delete the old dealer CSS`.

Then the final whole-branch review (`feat/portal-redesign..HEAD`), fixes, and step 3's plan.
