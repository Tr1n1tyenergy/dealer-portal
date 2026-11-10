# Portal redesign — Step 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all three portals the new design foundation — brand tokens, Century Gothic stack, shared controls and status chips, one header with the agreed menus, the restyled sign-in pages and branded error pages — without changing any behaviour.

**Architecture:** Tokens live in `src/app/globals.css` (Tailwind v4 `@theme`); the old `trinity-*` theme names are re-pointed at the new brand values so existing Tailwind classes pick them up at once. Two small pure modules carry the logic (`status-tone.ts`, `header-links.ts`) and are unit-tested; one `PortalHeader` component replaces the dealer sidebar, the staff top bar plus Retail sidebar, and gives the depot its first header. Page bodies keep their current styles until steps 2–4.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, plain CSS files, node:test + tsx, Playwright (scratch) for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-02-portal-redesign-design.md` (§3 foundation, §4 header, §6 sign-in rows, §8 rollout rules).

## Global Constraints

- Colours exactly: blue `#3853a4`, teal `#2cc0d2`, gradient `#3853a4 → #2cc0d2`, yellow `#ffca06`, ink `#18213a`, soft ink `#64708a`, ground `#f9fafb`, surface `#ffffff`, line `rgba(148,163,184,.3)`.
- Font stack exactly: `"Century Gothic", "TeX Gyre Adventor", sans-serif`; TeX Gyre Adventor self-hosted from `public/fonts/` (regular + bold, GUST licence file alongside). No Inter anywhere.
- Text: running text ≥ 16px, smallest text 13px; tabular figures for numbers; sentence case; no small all-caps labels in anything this step touches.
- Buttons pill-shaped: primary yellow/ink, secondary outlined, quiet text link, destructive outlined red. Every control has hover, pressed, keyboard-focus and disabled states. Motion only on transform/opacity and off under `prefers-reduced-motion`.
- Behaviour unchanged: same routes, same permissions, same sign-in rules. Every existing unit and DB test stays green.
- UI work follows the redesign-skill (taste family, apps); the brand gradient is allowed (brand exception).
- One branch: `feat/portal-redesign`. No Claude attribution in commits. Adrian pushes.

## Review Focus

1. A staff member with no permissions at all signs in → header shows only Home and the account menu, no empty "Admin ▾" — pinned in Task 3 tests.
2. A long company or user name ("PLACEHOLDER DEALER — OUTSPAN ELDORET") on a 390px phone → header never overflows; name truncates with an ellipsis — checked in Task 5 screenshots.
3. Keyboard user opens the phone/tablet menu → focus moves into it, Escape closes it and focus returns to the Menu button — Task 4 steps.
4. Pages that sized themselves around the old sidebars (dealer `dp-*`, staff `rad-*`) → no horizontal scroll at 390px after the sidebars go — checked in Task 5 screenshots (every staff and dealer page).
5. A device without Century Gothic (phone) → TeX Gyre Adventor actually loads (font request 200, rendered family not the browser default) — Task 1 verification.

---

### Task 1: Brand tokens and font

**Files:**
- Modify: `src/app/globals.css`
- Create: `public/fonts/texgyreadventor-regular.otf`, `public/fonts/texgyreadventor-bold.otf`, `public/fonts/GUST-FONT-LICENSE.txt`
- Create test: `src/lib/ui/tokens.test.ts`; add to `package.json` `"test"`

**Interfaces:**
- Produces CSS custom properties used by every later task: `--tri-blue`, `--tri-teal`, `--tri-gradient`, `--tri-yellow`, `--tri-ink`, `--tri-soft`, `--tri-ground`, `--tri-surface`, `--tri-line`, `--tri-radius-panel` (16px), `--tri-radius-control` (999px); `--font-sans` = the font stack. Tailwind theme names `trinity-blue` → `#3853a4`, `trinity-gold` → `#ffca06`, `trinity-navy` → `#18213a`, `trinity-bg` → `#f9fafb` (kept so existing classes re-colour; new code uses `--tri-*`).

- [ ] **Step 1: Write the failing test** `tokens.test.ts` — "globals.css carries the brand tokens and the Century Gothic stack": reads `src/app/globals.css` and asserts it contains `--tri-blue: #3853a4`, `--tri-teal: #2cc0d2`, `--tri-yellow: #ffca06`, `--tri-ink: #18213a`, `--tri-ground: #f9fafb`, `"Century Gothic", "TeX Gyre Adventor", sans-serif`, two `@font-face` blocks whose `src` files exist under `public/`, and does **not** contain `"Inter"`.
- [ ] **Step 2: Run** `node --import tsx --test src/lib/ui/tokens.test.ts` — Expected: FAIL (tokens missing, Inter present).
- [ ] **Step 3: Fetch the fonts** from CTAN (`https://mirrors.ctan.org/fonts/tex-gyre/opentype/texgyreadventor-regular.otf` and `-bold.otf`, licence from the same package's `doc`), into `public/fonts/`. Then edit `globals.css`: `:root` tokens above, `@font-face` for both weights (`font-display: swap`), `--font-sans` stack, re-pointed `trinity-*` theme colours, `font-variant-numeric: tabular-nums` on `body`, remove the Inter `font-feature-settings`.
- [ ] **Step 4: Run the test** — Expected: PASS. Run `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(ui): brand tokens and Century Gothic font stack`.

### Task 2: Shared controls and status chips

**Files:**
- Create: `src/lib/ui/status-tone.ts`, test `src/lib/ui/status-tone.test.ts` (add to `"test"`)
- Create: `src/components/ui/status-chip.tsx`, `src/components/ui/states.tsx` (`EmptyState`, `Skeleton`, `ErrorState`), `src/components/ui/ui.css` (imported once from `globals.css`)
- Modify: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/card.tsx`

**Interfaces:**
- Produces: `type Tone = "dealer" | "trinity" | "moving" | "done" | "problem" | "muted"`; `statusTone(status: DealerOrderStatus): Tone`; `<StatusChip status={DealerOrderStatus} label={string} />`; `<EmptyState title action? />`, `<Skeleton className? />`, `<ErrorState message onRetry? />`; Button variants `primary | secondary | quiet | destructive` (sizes `sm | md`). CSS classes `ui-navlink` (blue word, yellow underline slides in on hover/focus, `aria-current="page"` keeps it), `ui-tabs`, `ui-input`.
- Ruling for the plan: spec §3 names blue "Trinity is checking"; here blue covers every status where **Trinity** acts next (quotation, PFI being issued, payment verification, payment confirmed awaiting release). Cost if wrong: a chip colour.

- [ ] **Step 1: Write the failing test** `status-tone.test.ts`: every `DealerOrderStatus` maps to exactly one tone, with these cases: `PFI_ISSUED`, `AWAITING_PAYMENT`, `REQUIRES_AMENDMENT` → `dealer`; `SUBMITTED`, `ODOO_SYNC_PENDING`, `QUOTATION_CREATING`, `QUOTATION_READY`, `PFI_PENDING`, `PAYMENT_SUBMITTED`, `PAYMENT_VERIFICATION`, `PAYMENT_CONFIRMED` → `trinity`; `RELEASED_TO_DEPOT`, `LOADING`, `LOADED`, `DISPATCHED`, `IN_TRANSIT` → `moving`; `DELIVERED`, `CLOSED` → `done`; `ODOO_SYNC_FAILED`, `PAYMENT_EXCEPTION`, `STOCK_EXCEPTION`, `DELIVERY_EXCEPTION`, `REJECTED` → `problem`; `CANCELLED`, `DRAFT` → `muted`. Iterate `Object.keys(ORDER_TRANSITIONS)` so a new status fails the test until mapped.
- [ ] **Step 2: Run** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `statusTone` as a `Record<DealerOrderStatus, Tone>`; `StatusChip` (tone classes: dealer = yellow tint `#fff4cc`/`#7a5b00`, trinity = `#eceffa`/`#3853a4`, moving = `#e3f6f9`/`#0f6f7c`, done = `#e6f4ec`/`#1d6b41`, problem = `#fde8e8`/`#a1281f`, muted = `#eef0f4`/`#64708a`; text never wraps). Restyle Button, Input, Label, Card to the tokens and the Global Constraints; keep their exported names and props so the 8 existing Button call sites compile, mapping old variants `default → primary`, `navy → secondary`, `outline → secondary`, `ghost → quiet`, `danger → destructive`.
- [ ] **Step 4: Run** the new test, then `npx tsc --noEmit` and `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(ui): shared controls, status chips and list states`.

### Task 3: Header menus (logic)

**Files:**
- Create: `src/lib/ui/header-links.ts`, test `src/lib/ui/header-links.test.ts` (add to `"test"`)
- Modify: `src/lib/dealer/nav.ts`, `src/lib/dealer/nav.test.ts`

**Interfaces:**
- Consumes: `canUser(user, module, level)` from `src/lib/permissions.ts`.
- Produces: `type HeaderLink = { key: string; label: string; href: string }`; `type HeaderGroup = { key: string; label: string; links: HeaderLink[] }`; `headerLinks(portal: "dealer" | "staff" | "depot", user?: StaffUser): (HeaderLink | HeaderGroup)[]`; `activeDealerNav(pathname, view)` now returns `"dashboard" | "orders" | "pfis" | "messaging" | null`.

- [ ] **Step 1: Write the failing tests.** `header-links.test.ts`:
  - dealer → exactly `Dashboard /dealer/dashboard`, `Orders /dealer/orders`, `PFIs /dealer/orders?view=documents`, `Messages /dealer/messaging`, `Support` (key `support`, href `#support`).
  - staff Admin (all permissions) → `Home /intelligence/dashboard`, `Orders /intelligence/retail/orders`, `Analytics /intelligence/retail`, `Messages /intelligence/retail/messaging`, `Users /intelligence/retail/users`, then group `Admin` with `Admin users /intelligence/admin/users`, `Activity log /intelligence/admin/activity`, `Settings /intelligence/admin/settings`.
  - Sales Person Executive (role defaults) → Home, Orders, Analytics, Messages; no Users, no Admin group.
  - Staff Member with no permissions → only Home (Review Focus 1).
  - Staff Member with only `adminUsers.view` allowed → Home + Admin group containing only Admin users.
  - depot → only `Loading board /depot/dashboard`.
  - `nav.test.ts` updated: `/dealer/orders?view=payment` and `?view=deliveries` → `orders`; `?view=documents` → `pfis`; `/dealer/orders/new` → `null` (it is the yellow button, not a menu word); other existing cases unchanged.
- [ ] **Step 2: Run both tests** — Expected: FAIL.
- [ ] **Step 3: Implement** `headerLinks` (staff links filtered with `canUser(user, module, "view")`: Orders→orders, Analytics→analytics, Messages→messaging, Users→retailUsers, Admin users→adminUsers, Activity log→activity, Settings→settings; drop the Admin group when empty) and the new `activeDealerNav`.
- [ ] **Step 4: Run** — Expected: PASS; `npm test` all pass.
- [ ] **Step 5: Commit** `feat(ui): header menus per portal, filtered by permissions`.

### Task 4: `PortalHeader` component

**Files:**
- Create: `src/components/layout/portal-header.tsx` (client), `src/components/layout/portal-header.css`
- Read for reuse: `src/components/dealer/unread-bell.tsx` (or wherever `UnreadBell` lives), `src/components/dealer/quick-search.ts` (`quickSearchTarget`), `src/components/dealer/support-card.tsx` (`openSupport`)

**Interfaces:**
- Consumes: `headerLinks`, `activeDealerNav` (Task 3); `ui-navlink`, Button `primary` (Task 2).
- Produces: `<PortalHeader portal="dealer" | "staff" | "depot" user={StaffUser & { firstName?: string; lastName?: string; email?: string }} active={string | null} showMessagesBell={boolean} />`.

- [ ] **Step 1:** Build the bar per spec §4: white surface, logo left (existing `TrinityLogo`), menu words as `ui-navlink` with `aria-current="page"` on the active key, `Admin ▾` as a button with `aria-expanded` opening a small list. Right side: dealer — order-number search (reuse `quickSearchTarget`), `UnreadBell`, yellow `Place an order` link to `/dealer/orders/new`; staff — `UnreadBell` only when `showMessagesBell`; account button (initials) opening `My account` (dealer: existing account menu target; staff: none yet → omit the item) and `Sign out` (`signOut({ callbackUrl: loginPathFor(portal) })`). `Support` calls `openSupport()`. Long names truncate with an ellipsis (Review Focus 2).
- [ ] **Step 2:** Below 1024px replace the words with a `Menu` button opening a full-screen sheet listing the same links (dealer: `Place an order` first). Ruling for the plan: spec §4 folds overflow into "More ▾" on tablets; one Menu sheet for phone and tablet is simpler and keeps every link reachable — cost if wrong: tablets see the sheet instead of a partial bar. Focus moves into the sheet on open, Escape and the close button return focus to `Menu` (Review Focus 3).
- [ ] **Step 3: Verify** `npx tsc --noEmit` and `npx eslint src/components/layout` — Expected: clean.
- [ ] **Step 4: Commit** `feat(ui): PortalHeader for dealer, staff and depot`.

### Task 5: Put the header on every portal

**Files:**
- Modify: `src/components/dealer/dealer-shell.tsx` (drop sidebar and old top bar; keep `SupportCard` mount), `src/app/dealer/(portal)/layout.tsx`
- Modify: `src/components/layout/app-shell.tsx` (old staff header → `PortalHeader portal="staff"`), `src/app/intelligence/retail/layout.tsx` and `src/components/retail/retail-shell.tsx` (remove the Retail sidebar; content full width)
- Modify: `src/app/depot/dashboard/page.tsx` (add `PortalHeader portal="depot"`; the existing Sign out button moves into the account menu)
- Delete: CSS rules only the removed sidebars and top bars used (grep each class before deleting)

**Interfaces:**
- Consumes: `PortalHeader` (Task 4).

- [ ] **Step 1:** Wire the three portals. `showMessagesBell` = dealer always; staff `canUser(user, "messaging", "view")`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npx eslint src`, `npm test`, `npm run test:db` (test env, `RESEND_API_KEY=""`) — Expected: all pass.
- [ ] **Step 3: Screenshots** with the scratch Playwright setup against a production build on the throwaway DB (`tri_stress`): every dealer, staff and depot page at 1440, 768 and 390px, signed in as dealer, Admin, Sales Person Executive, Staff Member (no permissions) and depot. Expected: header correct per role (Review Focus 1), no horizontal scroll at 390px on any page (Review Focus 4), long names truncated (Review Focus 2), Menu sheet opens and closes by keyboard (Review Focus 3).
- [ ] **Step 4: Commit** `feat(ui): one header across the dealer, staff and depot portals`.

### Task 6: Sign-in pages and error pages

**Files:**
- Copy: brand photos to `public/assets2/img/brand/station-sunset.jpg`, `station-day.jpg` (from `D:\Downloads\Dealer portal files\brand-2026-11-02\`)
- Modify: `src/components/access/portal-login.tsx` (`portal` accepts `"staff"`; `BrandPanel` uses the station photo, tokens, no all-caps labels), `src/app/intelligence/login/page.tsx` (becomes `<PortalLogin portal="staff" …>`; the bespoke page is deleted), `src/app/dealer/login/page.tsx`, `src/app/depot/login/page.tsx`, `src/app/access/page.tsx`, `src/components/auth/activate-password-form.tsx`, `src/app/intelligence/forgot-password/page.tsx`, `src/app/intelligence/reset-password/page.tsx`
- Create: `src/app/not-found.tsx`, `src/app/error.tsx` (client), sharing the `BrandPanel` look with a "Go to your home page" link
- Test: existing `src/lib/assets/public-images.test.ts` covers the new photo paths; `src/lib/security/login-path.test.ts` stays green

**Interfaces:**
- Consumes: tokens, Button, Input, Label (Tasks 1–2).

- [ ] **Step 1:** Restyle the shared `BrandPanel`/`PortalLogin` (station-sunset photo full-bleed with a bottom-up dark scrim, white text on it; form on white). Staff login uses `PortalLogin portal="staff"` with the same sign-in call (`signIn("credentials", { portal: "staff" })`) and the same post-login destination (`/intelligence/dashboard`). Activation, forgot and reset pages use the same panel.
- [ ] **Step 2:** Add `not-found.tsx` and `error.tsx` (error page offers "Try again" via `reset()` and the home link).
- [ ] **Step 3: Verify** `npm test` (image-path test passes with the new photos), `npx tsc --noEmit`, a production build, and screenshots of all sign-in pages, a missing URL and a forced error at 1440 and 390px. Then sign in once on each portal in the browser — Expected: same destinations as before (dealer dashboard, staff dashboard, depot board).
- [ ] **Step 4: Commit** `feat(ui): sign-in, activation and error pages in the new design`.

### Task 7: Whole-branch check

- [ ] **Step 1:** `npm test`, `npm run test:db`, `npx tsc --noEmit`, `npx eslint src`, production build — Expected: all pass; record counts.
- [ ] **Step 2:** `grep -rn "Inter\"" src` and `grep -rn "font-family" src --include=*.css` — Expected: no Inter; any remaining `font-family` uses `var(--font-sans)`.
- [ ] **Step 3:** Publish the before/after screenshot set (1440/768/390, every page touched) for Adrian's browser check; list every deleted CSS block and component in the PR text.
- [ ] **Step 4:** PR text labelled **[All portals]**; no attribution; Adrian pushes and merges.
