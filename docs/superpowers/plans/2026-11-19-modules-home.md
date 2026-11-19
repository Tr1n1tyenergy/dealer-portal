# Modules Page Redesign (Direction D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/intelligence/dashboard` with the direction D "Night forecourt" page. It shows equal-width gradient panels for the modules each person can open, an Admin link row, and a live Retail summary line.

**Architecture:**
- The page is a server component. It loads the session, the role's modules (`visibleModules`), and the Retail counts.
- It renders a server-side `ModulesHome` with its own CSS. Sign-out reuses the existing client `SignOutButton` pattern.
- The count and summary logic lives in `src/lib/dashboard/summary.ts`:
  - `summaryLine` is pure and unit-tested;
  - `loadHomeCounts` uses the database and gets a DB test.
- The old cards, the popup, the hero and the footer are deleted.

**Tech Stack:** Next.js 15 app router, Prisma/Postgres, node:test + tsx, plain CSS, lucide-react icons, sharp (one-off asset conversion).

**Spec:** `docs/superpowers/specs/2026-11-19-modules-home-design.md`

## Global Constraints

- Brand colours: gradient #3853a4 → #2cc0d2; yellow #ffca06; dark navy overlay.
- Every module panel uses the gradient, and the panels are **equal width**.
- At 760px wide or less, the panels go to one column. No sideways scroll at 390px.
- Font: Century Gothic on this page only, via `src/styles/century-gothic.css`. The rest of the portal stays on Inter.
- Text is never under 12px. Focus rings are visible. The page respects reduced motion. `backdrop-filter` has a solid fallback.
- No numbers for Note Taker or Presentations. No KES total.
- Numbers are network-wide for everyone. A count the person may not see is never loaded or shown.
- If any count fails, the page still loads and that part is simply left out.
- Commits have no Co-Authored-By trailer.
- Run `npm test` AND `npm run test:db` (tri_test) before claiming done.

## Review Focus

1. **A Standard user (no Retail).** They should see no counts, no "need you" tag, the line "Where do you want to work today?", and Note Taker and Presentations only. Pinned in Task 1 unit tests and the Task 3 browser check.
2. **A count query that throws** (for example a DB hiccup). The page must still render, with that part missing. Pinned in Task 1 (`loadHomeCounts` with a failing dep).
3. **All counts zero.** The line reads "Nothing waiting for you right now.", not "Across the network today: ." Pinned in Task 1.
4. **A role whose permissions allow only some counts** (orders.view without orders.act). Only the allowed parts appear. Pinned in Task 1.
5. **Browsers without `backdrop-filter`, and the phone width.** The panels stay readable, and there's no horizontal scroll. Pinned in the Task 3 browser check on Firefox/WebKit at 390px.

---

### Task 1: Summary counts and line

**Files:**
- Create: `src/lib/dashboard/summary.ts`
- Test: `src/lib/dashboard/summary.test.ts` (add to `package.json` "test")
- Test: `src/lib/dashboard/summary.db.test.ts` (add to `package.json` "test:db")

**Interfaces:**
- Produces:
  - `type HomeCounts = { ordersToday: number | null; paymentsToConfirm: number | null; unreadMessages: number | null }`. Here `null` means "not allowed or failed: leave it out".
  - `summaryLine(c: HomeCounts): string`
  - `loadHomeCounts(user: { id: string } & StaffUser, deps?: { db?: PrismaClient-like; unread?: (userId: string) => Promise<number>; now?: Date }): Promise<HomeCounts>`

What `loadHomeCounts` loads, and the permission each count needs:

| Count | Needs | Query |
|---|---|---|
| `ordersToday` | `orders.view` | `dealerOrder.count({ where: { createdAt: { gte: nairobiTodayStart(now) } } })` |
| `paymentsToConfirm` | `orders.act` | `paymentRecord.count({ where: { status: { in: ["SUBMITTED", "VERIFICATION"] } } })` |
| `unreadMessages` | `messaging.view` | `unread(user.id)`, default `unreadMessageCount` |

- Each count without its permission is `null`.
- Each count is wrapped on its own: a throw gives `null`.
- The counts run in parallel.

- [ ] **Step 1: Write failing unit tests (`summary.test.ts`)**

```ts
summaryLine({ ordersToday: 7, paymentsToConfirm: 3, unreadMessages: 2 })
  === "Across the network today: 7 orders, 3 payments to confirm, 2 unread messages."
summaryLine({ ordersToday: 1, paymentsToConfirm: 1, unreadMessages: 1 })
  === "Across the network today: 1 order, 1 payment to confirm, 1 unread message."
summaryLine({ ordersToday: 7, paymentsToConfirm: 0, unreadMessages: null })
  === "Across the network today: 7 orders."
summaryLine({ ordersToday: 0, paymentsToConfirm: 0, unreadMessages: 0 }) === "Nothing waiting for you right now."
summaryLine({ ordersToday: null, paymentsToConfirm: null, unreadMessages: null }) === "Where do you want to work today?"
```

Then add three tests of `loadHomeCounts` with fake deps. The fake db's `count` methods return 5, and `unread` returns 2.
- A SUPER_ADMIN user gets `{5, 5, 2}`.
- A STANDARD_USER gets all `null`, and the fake db is never called.
- A SUPER_ADMIN whose `paymentRecord.count` throws gets `paymentsToConfirm: null`, with the others still filled in.

- [ ] **Step 2:** Run `node --import tsx --test src/lib/dashboard/summary.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `summary.ts` as specified. Use `canUser` from `@/lib/permissions`, `nairobiTodayStart` from `@/lib/retail/staff-home`, and `unreadMessageCount` from `@/lib/messaging/service`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Write the DB test (`summary.db.test.ts`)**, guarded by `*_test` like `messaging/service.db.test.ts`.
  - Setup: create one order today, and one with `createdAt` 2 days ago. Give one payment SUBMITTED, one VERIFICATION and one CONFIRMED.
  - Assert: `loadHomeCounts(adminUser)` gives `ordersToday` ≥ 1 and counts the new today order but not the old one. Compare against counts taken before the inserts.
  - Assert: `paymentsToConfirm` rose by exactly 2.
  - Clean up the rows it made.
- [ ] **Step 6:** Run `npm run test:db`. Expected: all pass.
- [ ] **Step 7:** Commit with the message `feat(staff): live summary counts for the modules page`.

### Task 2: The new page

**Files:**
- Create: `src/components/dashboard/modules-home.tsx` (server component) and `src/components/dashboard/modules-home.css`.
- Create: `public/assets2/img/hero/station-sunset.webp`.
  - Make it with sharp from `D:\Downloads\Dealer portal files\brand-2026-11-02\station-sunset.jpg`: 1920px wide, WebP at quality 68, about 190 KB.
- Modify: `src/lib/modules.ts`. Add `splitModules`; delete `FEATURED_MODULES`.
- Modify: `src/app/intelligence/dashboard/page.tsx`.
- Modify: `src/components/layout/app-shell.tsx`. Delete `ModulesHero`, `ModulesFooterStrip`, the `../dashboard/modules.css` import and the unused icons.
- Modify: `src/components/layout/app-shell.css`. Delete the `.mod-*` rules.
- Delete: `src/components/dashboard/module-cards.tsx`, `modules-launcher.tsx`, `modules-launcher.css`, `modules.css` and `feature-card.tsx` (unused).
- Test: `src/lib/modules.test.ts` (new; add to "test").

**Interfaces:**
- Consumes: `HomeCounts`, `summaryLine` and `loadHomeCounts` (Task 1); `visibleModules` and `TriModule` (`src/lib/modules.ts`); `greetingForHour` (`@/lib/retail/staff-home`); `nairobiParts` (`@/lib/time/nairobi`); `roleLabel` (`@/lib/access`); `SignOutButton` (`@/components/auth/sign-out-button`).
- Produces:
  - `splitModules(user: StaffUser): { work: TriModule[]; admin: TriModule[] }`. Admin is `category === "Admin"`, and the order is kept.
  - `ModulesHome(props: { greeting: string; line: string; name: string; role: string; work: TriModule[]; admin: TriModule[]; needYou: number })`.

- [ ] **Step 1: Write failing tests (`modules.test.ts`)**
  - SUPER_ADMIN: `work` ids are `["reports","note-taker","presentations"]` and `admin` ids are `["users","activity","settings"]`.
  - SALES_PERSON_EXECUTIVE: `work` is the same 3 and `admin` is `[]`.
  - STANDARD_USER: `work` is `["note-taker","presentations"]` and `admin` is `[]`.
- [ ] **Step 2:** Run it. Expected: FAIL (`splitModules` is not exported).
- [ ] **Step 3:** Implement `splitModules`. Run it. Expected: PASS.
- [ ] **Step 4: Make the WebP** with a one-off `node -e` sharp call; don't commit a script. Check the file is under 250 KB.
- [ ] **Step 5: Build `ModulesHome` and its CSS,** matching the mockup `D:\Downloads\modules-page-mockup-d-equal-widths-2026-11-19.html` (top, equal widths).

  Structure:
  - `<main class="mh">`. Background: the WebP, then a navy gradient overlay, then a light grain.
  - **Top row:**
    - the logo on a white chip, linking to `/intelligence/dashboard` (use `TrinityLogo variant="dark"`);
    - on the right: name, the role in small text, a pale initials box, and a sign-out icon button with `aria-label="Sign out"`.
  - **Hero:** the yellow eyebrow "Trinity Retail Intelligence", then `<h1>{greeting}.</h1>`, then `<p>{line}</p>`.
  - **Panels:** `<nav aria-label="Modules">` containing a grid with `grid-template-columns: repeat(N, 1fr)`, set through a CSS variable from `work.length`.
    - Each panel is one `<Link>` with: an icon, an `<h2>` title, a description, an optional tag, and "Open →".
    - Panel copy and titles:

      | Module id | Title | Description |
      |---|---|---|
      | `reports` | Retail | "Orders, payments, stations, stock, dealer messages and analytics." |
      | `note-taker` | AI Note Taker | "Record a meeting, get notes and actions." |
      | `presentations` | Presentations | "Notes to deck, present full screen." |

    - Retail shows the tag `{needYou} need you` only when `needYou > 0`.
  - **Admin row:** shown only when `admin.length`. A small uppercase "Admin" label, then a `Link` for each item, with the icon and `title` ("Activity Logs" displays as "Activity logs").
  - **Empty state:** when `work.length + admin.length === 0`, show today's text, "No modules are available for your role yet. Ask an Admin if you need access."

  CSS:
  - `@import` or a page-level import of `@/styles/century-gothic.css`.
  - Use `font-family: "Century Gothic", sans-serif` on `.mh` only.
  - `@supports not (backdrop-filter: blur(1px))` gives a solid `rgba(20,40,100,.92)` panel background.
  - At `@media (max-width: 760px)`: one column, smaller h1 (32px), 16px side padding.
  - The hover lift and transitions are turned off under `prefers-reduced-motion: reduce`.
  - `min-height: 100dvh`.
- [ ] **Step 6: Rewrite `dashboard/page.tsx`:**
  - `requireSession()`;
  - `const { work, admin } = splitModules(user)`;
  - `const counts = await loadHomeCounts(user)`;
  - `greeting = greetingForHour(nairobiParts(new Date()).hour)`;
  - name and role as `AppShell` builds them (firstName + lastName, `roleLabel(role)`);
  - `needYou = counts.paymentsToConfirm ?? 0`;
  - render `<ModulesHome …/>` **without** `AppShell`.
- [ ] **Step 7: Delete the old files and code** listed above. Grep for `ModuleCards|ModulesLauncher|ModulesHero|ModulesFooterStrip|FEATURED_MODULES|FeatureCard|modules.css|modules-launcher` across `src`. Expected: no hits.
- [ ] **Step 8:** Run `npx tsc --noEmit`, `npx eslint src/components/dashboard src/app/intelligence/dashboard src/lib/dashboard src/lib/modules.ts src/components/layout`, and `npm test`. Expected: no errors, and every test passes.
- [ ] **Step 9:** Commit with the message `feat(staff): modules page redesign (night forecourt, equal gradient panels, live Retail line)`.

### Task 3: Real-browser check and full verification

**Files:** none in the repo. Scripts go in the scratchpad `pw/`.

- [ ] **Step 1:** Run `npm run build`, then `next start` on tri_stress. Use throwaway logins for SUPER_ADMIN, SALES_PERSON_EXECUTIVE and STANDARD_USER, with the env rules of `local-test-server`: blank `RESEND_API_KEY`, `ODOO_MODE=mock`.
- [ ] **Step 2: Run Playwright** on Chromium, Firefox and WebKit at 1366, 820 and 390 wide, for each role.
  - `scrollWidth === innerWidth`.
  - The panel count is 3, 3 and 2; all panels are the same width (to ±1px) on desktop.
  - The Admin row shows only for the admin.
  - The Standard user line is "Where do you want to work today?".
  - Each panel link navigates to its module.
  - Sign-out goes to `/access`.
  - No text is under 12px (computed font-size).
  - Take a screenshot of each combination.
- [ ] **Step 3:** Run `npm test` and `npm run test:db`. Expected: all pass. Record the counts.
- [ ] **Step 4:** Final whole-branch review by a fresh reviewer, then fix the Critical and Important findings with RED→GREEN tests. Write the PR text to `D:\Downloads\pr-modules-home.md`.
