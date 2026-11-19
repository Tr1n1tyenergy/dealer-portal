# Modules page redesign (direction D, "Night forecourt")

**Date:** 19 Nov 2026 · **Status:** approved by Adrian (direction D, gradient on every panel, live numbers) · **Size:** small change
**Mockup:** `D:\Downloads\modules-page-mockup-d-2026-11-19.html` (role switcher: Super Admin / Sales Person Executive / Standard user)

## Why

`/intelligence/dashboard` is the first page every staff member sees after signing in, and where "no access" redirects land. Adrian doesn't like how it looks. It also repeats itself: the three cards and the "Browse all modules" popup list the same modules. The page is dark navy with old colours (#173d8f / #ffcc00), so it doesn't match the brand or the Retail portal you go to next.

The page serves both regular staff and executives/admins. It must look complete whether someone can open 2 modules or 6.

## Goals

- Use direction D: a full-bleed photo of a real Trinity station at dusk, with a dark navy overlay.
  - Below it: a greeting, then one line with live numbers, then a frosted panel per module.
  - **Every** module panel uses the brand gradient (#3853a4 → #2cc0d2).
- Show each person only the modules their role can open. This keeps the existing `visibleModules(user)`.
  - The work modules (Retail, AI Note Taker, Presentations) are large panels. The first one is the widest.
  - The admin tools (Users, Activity logs, Settings) are a small "Admin" row of links under the panels. Only people who can open them see it.
- Show live numbers, for Retail only:
  - **The line under the greeting.** For example: "Across the network today: 7 orders, 3 payments to confirm, 2 unread messages."
  - **A yellow "3 need you" tag on the Retail panel.** It counts payments waiting for confirmation.
- It works on phones: the panels stack, and nothing scrolls sideways.

## Non-goals

- No numbers for Note Taker or Presentations until those modules are built for real. That is a separate project, and next.
- No change to permissions, or to which roles see which modules.
- No portal-wide font or colour change.

## Anti-goals

- No duplicate lists of modules on the page.
- No filler: no "Enterprise Intelligence Suite" badge, feature checklists or reassurance tiles.
- No number that the person can't act on or isn't allowed to see.

## Approaches considered

1. **A / B / C (round one):** a light launchpad, a brand band, a quiet list. Adrian felt no appeal.
2. **D / E / F (round two):**
   - D: night forecourt with glass panels.
   - E: light bento with live tiles.
   - F: an app-icon "home screen".
3. **Picked: D**, plus the gradient on every panel and E's idea of live numbers. Adrian chose it: "I'd love that for both [staff and admins]".

## Design

**Page.** This replaces `ModulesHero`, `ModuleCards`, `ModulesFooterStrip` and the `ModulesLauncher` popup on `src/app/intelligence/dashboard/page.tsx`.

**Top bar, over the photo.**
- The logo sits on a white chip and links to this page.
- Name and role on the right, then sign-out.
- The floating accessibility button stays as it is in `app/layout.tsx`.

**Hero text.**
- A yellow eyebrow: "Trinity Retail Intelligence".
- The greeting, from the existing `greetingForHour(nairobiParts(now).hour)`.
- The summary line.

**The summary line.** It is built from the counts this person may see, in this order:
- `N orders today`: dealer orders created since `nairobiTodayStart`. Needs `orders.view`.
- `N payments to confirm`: payments still waiting. It uses the same statuses as the staff Home "Needs Action" list. Needs `orders.act`.
- `N unread messages`: `unreadMessageCount(user.id)`. Needs `messaging.view`.

How the line reads:
- With any of those permissions, it reads "Across the network today: …" and lists only the parts that apply.
- With none, it reads "Where do you want to work today?"
- Zero counts are left out. If every count is zero, the line reads "Nothing waiting for you right now."

**The panel tag.**
- Retail shows "N need you" (payments to confirm), but only when N > 0 and the person has `orders.act`.
- Other panels show no tag for now.

**Panels.**
- Each panel has an icon, its title, a one-line description and "Open →". The whole panel is the link.
- Desktop grid: the first panel is 1.4fr and the rest are 1fr each.
- At 760px or narrower, it becomes one column.
- Panel text (role-neutral):
  - **Retail:** "Orders, payments, stations, stock, dealer messages and analytics."
  - **AI Note Taker:** "Record a meeting, get notes and actions."
  - **Presentations:** "Notes to deck, present full screen."

**Admin row.** Links to Users, Activity logs and Settings. Each one shows only if `visibleModules` includes it.

**No modules.** Keep today's message ("No modules are available for your role yet. Ask an Admin…"), restyled on the photo.

**If a count fails.** Leave that part out of the line. The page must still load (the same try/catch pattern the staff layout uses for `unreadMessageCount`).

**Assets.**
- `station-sunset.jpg` (1.3 MB) is resized and compressed to a 1920px WebP of about 190 KB, saved at `public/assets2/img/hero/station-sunset.webp`.
- It loads as a CSS background, with a dark overlay so the text stays readable.

**Style.**
- Its own CSS file, using the brand tokens: #3853a4, #2cc0d2, #ffca06 and navy #0a1434.
- The panels use `backdrop-filter`, with a solid fallback when the browser doesn't support it.
- Focus rings are visible.
- Text is never smaller than 12px. The page follows the reduced-motion setting.

## My calls (Adrian to check)

- **Font:** Century Gothic on this page only, through the repo's existing `src/styles/century-gothic.css` (system Century Gothic, or the bundled TeX Gyre Adventor). The mockup Adrian approved uses it. The rest of the portal stays on Inter until the portal-wide font decision.
- **No "KES ordered today" in the line.** It was in the mockup, but order value (`amountDue`) only exists once a PFI is issued, so the figure would mislead.
- **Numbers count the whole network for everyone,** because staff orders aren't assigned to individual people. The wording stays the same for every role.
- **Old code is deleted:** `module-cards.tsx`, `modules-launcher.tsx`, `ModulesHero` / `ModulesFooterStrip`, plus any of their CSS nothing else uses. Check `app-shell.tsx`, which also references "Browse all modules".

## Left to the builder

- The exact overlay opacity, panel min-height and spacing, matched to the mockup.
- Where the count queries live. Suggested: a small `src/lib/dashboard/summary.ts` with a unit-tested, pure `summaryLine(counts, perms)`.
- Tests:
  - the summary-line rules: permissions, zeros, all zero, none;
  - that the panels shown match `visibleModules` for each role;
  - a DB test of the counts.
- Browser checks: Chromium, Firefox and WebKit at 1366, 820 and 390 wide, for each of the three roles.
