# Portal redesign step 3 (staff portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The staff portal goes from dark to the light E2 style. A real home page ("what waits on Trinity") replaces the module launcher. Orders, Analytics, Users, Admin and Messages restyled. Every screen shows only the buttons the person may use.

**Architecture:** The step-2 page pattern (`PageHead`, `.ui-page`, `.ui-panel`, `.ui-field`/`.ui-input`, `StatusChip`) on the staff shell, now light. The photo header becomes a shared `PhotoHero`, used by the dealer dashboard, the staff home and (in step 4) the depot. New logic, each test-first:
- which actions an order offers (shared by Orders and Home);
- the staff home sentence and buttons;
- the month value sum;
- which user-screen controls a person sees.

**Tech Stack:** Next.js 15, React 19, CSS with `--tri-*` tokens, node:test via tsx, Playwright-core checks.

**Spec:** `docs/superpowers/specs/2026-11-02-portal-redesign-design.md` (§4 staff header, §5 staff home, §6 working pages, §7 permission items, §8 step 3)

## Global Constraints

- One branch for the whole redesign: `feat/portal-redesign` (steps 1–4, one PR). Nothing is pushed until step 4 is built. No attribution lines.
- Behaviour unchanged: same queries, server actions (`internalOrderAction`), API calls, query strings (`?stage=`, `?q=`), permission checks on every page and API. The only behaviour change is that buttons the person can't use are hidden (spec §7).
- Tokens and `ui.css` only. Raw colours used repeatedly in steps 1–2 become tokens in Task 8 (`--tri-problem #a1281f`, `--tri-tint #eef2fb`).
- Yellow for the one main action; sentence case; body 16px, small 13px minimum (Messages included); tabular figures; no small all-caps.
- No sideways scroll at 390px; tables become stacked rows under 768px.
- Note Taker and Presentations stay hidden and unstyled.
- UI work follows the redesign-skill.
- Tests: `npm test` (with the stress `.env` loaded, for the session-length test), `env -u DATABASE_URL RESEND_API_KEY="" npm run test:db`, browser checks on a production build on `tri_stress` (:3996).

## Review Focus

1. A Staff Member with no permissions: Home says "Ask an Admin for access." The page shows no order data, and the header shows only Home.
2. View-only staff (`orders.view` without `act`): Orders and Home list orders with **no** action buttons. Without `retailUsers.act`, Users shows no invite forms. Without `adminUsers.act`, Admin users shows no Enable/Reset/Delete/Permissions.
3. A non-Admin with `adminUsers.act` never sees Permissions on an Admin's row (the server already refuses it, `permissions-admin.ts:32`).
4. Long dealer names and quotation numbers on Orders at 390px: no sideways scroll, and quotation numbers don't break mid-number.
5. An expired or near-expiry price list: the Orders banner still shows (`role="alert"` when expired) in the new style.

Lines 1–3 are pinned by the Task 3, 5 and 6 unit tests plus the Task 1 browser check (roles admin / spe / staff-no-access); 4–5 by the Task 2 check.

---

### Task 1: Light staff shell and the step-3 browser check

**Files:**
- Modify: `src/components/layout/app-shell.tsx` (drop `IntelligenceBackground`, the navy inline style, `suppressIntelligenceBackground`/`fullBleed` handling becomes one light `tri-main`)
- Modify: `src/components/layout/app-shell.css`, `src/app/intelligence/retail/retail-portal.css` (`.ri-shell`/`.ri-content` light)
- Delete when unused: `src/components/layout/intelligence-background.tsx` + `.css`
- Create (scratch): `pw/staff-step3-check.cjs`

**Interfaces:** Produces `staff-step3-check.cjs`. Roles: admin, spe, staff-no-access, plus a view-only staff user. It creates one in `tri_stress` if missing: `orders.view` + `retailUsers.view` + `adminUsers.view` allowed, no `act`. Pages: `/intelligence/dashboard`, `/intelligence/retail`, `/intelligence/retail/orders?stage=all`, `/intelligence/retail/messaging`, `/intelligence/retail/users`, `/intelligence/admin/users`, `/intelligence/admin/activity`, `/intelligence/admin/settings`, each at 1440/768/390, skipping pages the role can't open. It fails on:
- sideways scroll;
- `main` background not `rgb(249, 250, 251)`;
- not exactly one `h1`;
- small all-caps;
- tabs wrapping;
- a page error;
- for view-only and staff-no-access: any visible button whose text is in {Confirm payment, Flag exception, Release to depot, Generate PFI, Finish PFI, Retry sync, Send dealer invite, Send staff invite, Delete, Disable, Enable, Reset invite, Permissions}.

- [ ] Step 1: Write the check. Run it on the current build. Expected: FAIL (dark ground, small caps, view-only sees Delete/Invite).
- [ ] Step 2: Light shell. `npx tsc --noEmit`, `npx eslint src`. Expected: clean.
- [ ] Step 3: Commit `feat(staff): light shell`.

### Task 2: Staff Orders (shared order actions)

**Files:**
- Create: `src/lib/orders/staff-actions.ts` + `.test.ts`; `src/components/retail/order-actions.tsx`
- Modify: `src/app/intelligence/retail/orders/page.tsx`; rewrite `src/app/intelligence/retail/retail-orders.css` (root class `.so`, ending the `.ro` clash with the dealer list)

**Interfaces:**
- Produces `staffOrderActions(status: DealerOrderStatus): StaffOrderAction[]` where `StaffOrderAction = "retry-sync" | "generate-pfi" | "finish-pfi" | "confirm-payment" | "reject-payment" | "release"`. The mapping is today's branching: ODOO_SYNC_FAILED/PENDING → retry-sync; QUOTATION_READY/PFI_PENDING → generate-pfi; PFI_ISSUED → finish-pfi; PAYMENT_VERIFICATION → confirm-payment + reject-payment; PAYMENT_CONFIRMED → release; else [].
- Produces `<OrderActions orderId status depots mayAct />`:
  - renders nothing unless `mayAct`;
  - one `<form action={internalOrderAction}>` with the same hidden `orderId` and `name="action"` values as today (`finish-pfi` still posts `value="generate-pfi"`);
  - Confirm payment = `ui-btn--primary`, Flag exception = `ui-btn--destructive`, Release to depot = `ui-btn--primary` with the depot `ui-input` select, the others = `ui-btn--secondary`.

- [ ] Step 1: Tests:
  - `staffOrderActions("PAYMENT_VERIFICATION")` deep-equals `["confirm-payment","reject-payment"]`;
  - `("PFI_ISSUED")` → `["finish-pfi"]`;
  - `("ODOO_SYNC_FAILED")` → `["retry-sync"]`;
  - `("PAYMENT_CONFIRMED")` → `["release"]`;
  - `("DELIVERED")` → `[]`.

  Run: FAIL (module missing).
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Page:
  - `PageHead title="Orders"` with the current description shortened to one line;
  - the price-list banner (same text and roles) as a soft panel;
  - `ui-tabs` with counts (one row, scrolls);
  - search = `ui-input` + `ui-btn--secondary` "Search".
  - The list: desktop table with sentence-case headers. Order (bold), Dealer, Station, Quotation (`white-space: nowrap`), PFI link, Amount (+ "Paid: …" / mismatch in `--tri-problem`), `StatusChip` with `statusLabel()` (+ the Odoo error note), Actions = `OrderActions`.
  - Under 768px each `tr` becomes a stacked grid (order + chip, dealer · station, quotation · PFI, amount, actions).
  - Empty text unchanged.
- [ ] Step 4: Suites + build; `staff-step3-check.cjs` for Orders. Expected: no Orders problems. For Review Focus 5, screenshot the banner in whatever state `priceListStatus(today)` gives and ledger which state was seen.
- [ ] Step 5: Commit `feat(staff): Orders in the E2 style with shared order actions`.

### Task 3: Staff home (replaces the module launcher)

**Files:**
- Create: `src/lib/staff/home-summary.ts` + `.test.ts`; `src/components/layout/photo-hero.tsx` + `photo-hero.css`
- Modify: `src/lib/orders/money.ts` (+ test) for `sumKes`; `src/app/intelligence/dashboard/page.tsx`; `src/app/dealer/(portal)/dashboard/page.tsx` + `dashboard.css` (use `PhotoHero`, delete its `.dd-hero*` rules)
- Delete when unused: `src/components/dashboard/*` (module cards, launcher, feature card, modules CSS), `ModulesHero`/`ModulesFooterStrip` in app-shell

**Interfaces:**
- `PhotoHero({ image, place?, title, sentence, actions? })`: the E2 hero from the dealer dashboard, moved as-is (same scrim, sizes, phone rules).
- `staffHomeSummary(counts: Partial<Record<DealerOrderStatus, number>>): { sentence: string; actions: { label: string; href: string }[] }`:
  - Counted groups: payments to check = PAYMENT_SUBMITTED + PAYMENT_VERIFICATION → `?stage=verification`; orders to release = PAYMENT_CONFIRMED → `?stage=paid`; PFIs to issue = QUOTATION_READY + PFI_PENDING + PFI_ISSUED → `?stage=pending`; stuck at Odoo = ODOO_SYNC_FAILED → `?stage=exceptions`.
  - Sentence: the non-zero groups joined with ", " and ending in ".", singular or plural, e.g. "3 payments to check, 1 order to release, 1 order stuck at Odoo." With none: "Nothing waits on Trinity right now."
  - Actions: one per non-zero group, in that order, labels "Check payments", "Release orders", "Issue PFIs", "Fix Odoo sync"; at most 2 (the first is primary).
- `sumKes(amounts: (string | null)[]): string`: cents-exact sum, `"0.00"` for none.

- [ ] Step 1: Tests:
  - `staffHomeSummary({ PAYMENT_VERIFICATION: 2, PAYMENT_SUBMITTED: 1, PAYMENT_CONFIRMED: 1, ODOO_SYNC_FAILED: 1 })` → sentence "3 payments to check, 1 order to release, 1 order stuck at Odoo.", actions hrefs `["/intelligence/retail/orders?stage=verification","/intelligence/retail/orders?stage=paid"]`;
  - `staffHomeSummary({})` → "Nothing waits on Trinity right now." and `[]`;
  - `sumKes(["1225746.00", null, "0.10", "0.20"])` → `"1225746.30"`.

  Run: FAIL.
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Staff home page.
  - `PhotoHero` with the station photo, "Good afternoon, {firstName}" (Nairobi), the sentence, the actions.
  - Below (only with `orders.view`): "Needs action", the latest 8 orders in the counted statuses as list rows (reference, dealer, station, chip, `OrderActions` with `mayAct = orders.act`), plus "See all orders".
  - "This month" (orders, litres, value via `dashboardSummary(...).month` + `sumKes` of `amountDue`, cancelled/rejected/draft left out).
  - No `orders.view` and no other module: sentence "Ask an Admin for access." and nothing else.
  - Dealer dashboard switched to `PhotoHero` with no visual change (compare 1440/390 screenshots before/after).
- [ ] Step 4: Suites; commit `feat(staff): home page with what waits on Trinity; shared PhotoHero`.

### Task 4: Analytics

**Files:** `src/components/retail/retail-analytics-dashboard.tsx` (markup/classes only), rewrite `src/app/intelligence/retail/retail-analytics.css`, `src/app/intelligence/retail/page.tsx` (`PageHead title="Analytics"` with the date range as description)

- [ ] Step 1: KPI row as four plain figures on white panels (label, number, "vs last month" change in soft ink, green/red only for the arrow). Trend chart in brand blue (PMS) and teal (AGO). Status breakdown legend using the chip colours. Top stations bars in the brand gradient. Recent orders as list rows with `StatusChip`. Same data and props; no new numbers.
- [ ] Step 2: Build; `staff-step3-check.cjs` for Analytics; screenshot. Commit `feat(staff): Analytics in the E2 style`.

### Task 5: Users (invites gated)

**Files:** Create `src/lib/users/user-controls.ts` + `.test.ts`; modify `src/components/retail/retail-users-client.tsx`; rewrite `src/app/intelligence/retail/retail-users.css`

**Interfaces:** `retailUsersControls(user: StaffUser | null | undefined): { invite: boolean; manage: boolean }`, where invite = `canUser(user, "retailUsers", "act")` and manage = `canUser(user, "adminUsers", "act")`.

- [ ] Step 1: Tests:
  - a user with only `retailUsers.view` allowed → `{ invite: false, manage: false }`;
  - `SUPER_ADMIN` → `{ invite: true, manage: true }`;
  - a dealer account → both false.

  Run: FAIL.
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Client:
  - invite forms render only when `invite`; otherwise one line: "You can view users here. Ask an Admin to invite people."
  - Edit/Delete row controls only when `manage` (as today).
  - Restyle: `PageHead title="Users"`, two invite panels with `ui-field` labels above inputs, the pending-invitations and users lists as rows with chips (Pending = dealer, Active = done, Disabled = muted), and the edit dialog as a white panel.
  - Drop the decorative "Secure Access" box and the background photo in the dealer panel.
- [ ] Step 4: Suites; build; check; commit `feat(staff): Users in the E2 style; invites only for people who may send them`.

### Task 6: Admin users, Permissions window, Activity, Settings

**Files:** Modify `src/lib/users/user-controls.ts` (+ test); `src/components/admin/users-admin-client.tsx`, `permissions-dialog.tsx`; `src/app/intelligence/admin/{users,activity,settings}/page.tsx`

**Interfaces:** `adminRowActions(actor: StaffUser, row: { role: string; accountType: string; email: string }): { toggle: boolean; resetInvite: boolean; permissions: boolean; delete: boolean }`:
- all false without `adminUsers.act`;
- `permissions` only for INTERNAL rows, and never on a `SUPER_ADMIN` row unless the actor is `SUPER_ADMIN`;
- `delete` also respects `mayDeleteProtectedAdmin(actor.email, row.email)`.

- [ ] Step 1: Tests:
  - view-only actor → all false;
  - actor with `adminUsers.act` (role STANDARD_USER + allow tick) on a SUPER_ADMIN row → `permissions: false`, toggle/reset true;
  - SUPER_ADMIN actor on a SUPER_ADMIN row → `permissions: true`;
  - DEALER row → `permissions: false`.

  Run: FAIL.
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Admin users rows show only the allowed buttons. Restyle: `PageHead`, the create form as a `ui-panel`, users as rows/table with chips, buttons `ui-btn--secondary`/`--destructive`. Permissions window: white panel, Allow/Inherit/Deny as a segmented control per module, focus trap kept. Activity and Settings: `PageHead` + `ui-panel` lists, no Card dark styles.
- [ ] Step 4: Suites; build; check; commit `feat(staff): Admin screens in the E2 style; row buttons only when allowed`.

### Task 7: Staff Messages frame

**Files:** `src/app/intelligence/retail/messaging/page.tsx` (`PageHead title="Messages" description="Conversations with dealers and Trinity teams."`, the dealer page's workspace sizing), delete `retail-messaging.css` when unused; `messaging.css` font sizes below 13px raised to 13px, list hover tint lighter than the selected row (deferred minor).

- [ ] Step 1: Changes; `grep -nE "font-size: 0\.(6|7)[0-9]*rem|font-size: 1[0-2]px" src/components/messaging/messaging.css` → no output.
- [ ] Step 2: Build; `msg-check.cjs` + `msg-focus-check.cjs` (staff and dealer). Commit `feat(staff): Messages page in the E2 style`.

### Task 8: Tokens, dead CSS, full check, screenshots

- [ ] Step 1: Add `--tri-problem` and `--tri-tint` to `globals.css` (and the tokens test). Replace those raw values in `ui.css`, `portal-header.css` and the step 2–3 CSS files.
- [ ] Step 2: `prune_unused.py` on `app-shell.css`, `retail-portal.css` and the staff CSS. Delete unused files and images under `public/assets2/img/retail` and `/intelligence` if nothing references them.
- [ ] Step 3: Build; run every check (`staff-step3-check`, `dealer-step2-check`, `review-fixes-check`, `msg-check`, `msg-focus-check`, `keyboard-check`, `po-flow`). Expected: all "no problems". Keyboard pass on Orders actions, Users invite, the Permissions window.
- [ ] Step 4: Unit, DB, tsc, eslint, build. Screenshots to `D:\Downloads\portal-redesign-step3-screens\`; PR text `D:\Downloads\pr-portal-redesign-step3.md`.
- [ ] Step 5: Commit `chore(staff): tokens for repeated colours; delete the old staff CSS`.

Then the final review of this step's commits (`00dd211..HEAD`), fixes, and step 4's plan.
