# Accessibility Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-device Accessibility menu (text size, high contrast, reduce motion, readable font) on every page of every portal.

**Architecture:** One pure module owns the stored preferences and the `<html data-a11y-*>` attributes; a tiny inline `<head>` script generated from it applies them before paint; one stylesheet reacts to the attributes; one client component renders the trigger + panel, floating from the root layout and in the dealer/staff headers.

**Tech Stack:** Next.js 15 app router, plain CSS, lucide-react icons, node:test + tsx, Playwright Chromium + axe-core (already installed) for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-17-accessibility-menu-design.md`

## Global Constraints

- Storage: `localStorage` key `tri-a11y`, value `{ "text": "normal|large|xlarge", "contrast": bool, "motion": bool, "font": bool }`; every access in `try/catch`; bad values → defaults.
- Attributes on `<html>`: `data-a11y-text="large|xlarge"`, `data-a11y-contrast`, `data-a11y-motion="reduce"`, `data-a11y-font="readable"`; defaults set none.
- Text scale: Large × 1.15, Extra large × 1.3 of `var(--tri-root-font)`.
- High-contrast values: greys `#475569`, green `#047857`, gold `#8a6100`; focus `outline: 3px solid #1e3a8a; outline-offset: 2px`.
- Readable font: `Verdana, Tahoma, sans-serif`, `letter-spacing: 0.02em`, `word-spacing: 0.08em`; monospace elements keep monospace.
- Normal mode must look identical to main.
- No new dependencies. No DB change. Unit test files must be added to the `"test"` list in `package.json`.

## Review Focus

1. `localStorage` throws (Safari private, blocked storage) → page still renders, menu still toggles for the session, no console error loop.
2. Stored JSON from a future/older shape (`{"text":"huge"}`, `null`, `"[]"`) → defaults, and no attribute is written from unchecked input (no attribute injection).
3. Extra large at 390 px and 1280 px → header nav and the panel itself fit; no sideways page scroll.
4. Inline script runs before React hydrates → no hydration warning from `<html>` attributes (needs `suppressHydrationWarning` on `<html>`).
5. Two triggers (header + floating) on the same page → only one visible; both open the same state.

Each is pinned by a test in the owning task (1, 2 → Task 1; 4 → Task 2; 3, 5 → Task 5).

---

### Task 1: Preferences module

**Files:**
- Create: `src/lib/a11y/preferences.ts`
- Test: `src/lib/a11y/preferences.test.ts` (add to `package.json` `"test"`)

**Interfaces:**
- Produces:
  - `type A11yPrefs = { text: "normal" | "large" | "xlarge"; contrast: boolean; motion: boolean; font: boolean }`
  - `const A11Y_DEFAULTS: A11yPrefs` (normal, false, false, false); `const A11Y_STORAGE_KEY = "tri-a11y"`
  - `parsePrefs(raw: string | null | undefined): A11yPrefs`
  - `prefsAttributes(p: A11yPrefs): Record<string, string>` — only non-default attributes, e.g. `{ "data-a11y-text": "large", "data-a11y-contrast": "" }`
  - `applyPrefs(root: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void }, p: A11yPrefs): void` — sets present, removes absent of the four names
  - `readPrefs(storage?: Pick<Storage, "getItem">): A11yPrefs`; `writePrefs(p: A11yPrefs, storage?: Pick<Storage, "setItem">): void` — both swallow storage errors
  - `const A11Y_HEAD_SCRIPT: string` — self-contained JS (no imports) doing read → parse → apply on `document.documentElement`

- [ ] **Step 1: Write the failing tests** — `parsePrefs` returns defaults for `null`, `""`, `"not json"`, `"[]"`, `'{"text":"huge"}'`; keeps valid fields from a partial object (`'{"contrast":true}'` → contrast true, rest default); `prefsAttributes(A11Y_DEFAULTS)` is `{}`; all-on gives exactly the four names with values `xlarge`, `""`, `reduce`, `readable`; `applyPrefs` on a fake root removes stale names; `readPrefs`/`writePrefs` with a storage whose methods throw return defaults / do not throw; `A11Y_HEAD_SCRIPT` evaluated with `new Function("document","localStorage", A11Y_HEAD_SCRIPT)` against fakes sets `data-a11y-text="large"` for stored `{"text":"large"}` and sets nothing (and does not throw) when `localStorage.getItem` throws or the value is `'{"text":"<x onerror=1>"}'`.
- [ ] **Step 2: Run** `node --import tsx --test src/lib/a11y/preferences.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `src/lib/a11y/preferences.ts`. The head script must whitelist values the same way `parsePrefs` does (it cannot import it); keep it under ~600 characters.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** `feat(a11y): preferences module`.

### Task 2: Stylesheet + no-flash head script

**Files:**
- Create: `src/styles/accessibility.css`
- Modify: `src/app/globals.css` (import after `responsive-tokens.css`), `src/app/layout.tsx` (`<html lang="en" suppressHydrationWarning>`, `<script dangerouslySetInnerHTML={{ __html: A11Y_HEAD_SCRIPT }} />` first in `<head>`)
- Test: `src/lib/a11y/stylesheet.test.ts` (add to `"test"`)

**Interfaces:**
- Consumes: `A11Y_HEAD_SCRIPT` (Task 1).
- Produces: CSS variables `--tri-text-faint`, `--tri-text-faint-green`, `--tri-text-faint-gold` (defined only under `html[data-a11y-contrast]`; Task 4 uses them with fallbacks).

- [ ] **Step 1: Write the failing test** — reads `src/styles/accessibility.css` as text and asserts it contains: `html[data-a11y-text="large"]` with `calc(var(--tri-root-font) * 1.15)`; `"xlarge"` with `* 1.3`; a `prefers-reduced-motion: reduce` block and an `html[data-a11y-motion="reduce"]` block both setting `transition-duration: 0.01ms !important`; `html[data-a11y-font="readable"]` with `Verdana`; `html[data-a11y-contrast]` defining the three variables with `#475569`, `#047857`, `#8a6100` and the `--msg-muted`, `--ri-muted`, `--tri-muted-soft`, `--ru-multi-muted`, `--ro-muted` overrides; and that `src/app/layout.tsx` contains `suppressHydrationWarning` and `A11Y_HEAD_SCRIPT`.
- [ ] **Step 2: Run** — Expected: FAIL (file missing).
- [ ] **Step 3: Write the stylesheet and layout changes.** Font override targets `html[data-a11y-font="readable"] body, …body *:not(code):not(pre):not(kbd):not(samp)` with `!important` (8 hard-coded Inter stacks exist). Contrast also darkens default borders (`* { border-color }` only where the base rule uses `border-black/10` → `rgba(0,0,0,.35)`) and adds the focus outline.
- [ ] **Step 4: Run** test — PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(a11y): stylesheet and no-flash head script`.

### Task 3: Menu component and placements

**Files:**
- Create: `src/components/a11y/accessibility-menu.tsx` (`"use client"`), `src/components/a11y/accessibility-menu.css`
- Modify: `src/app/layout.tsx` (render `<AccessibilityMenu variant="floating" />` inside `<body>` after providers), `src/components/staff/staff-portal-shell.tsx` (before the bell link), `src/components/dealer/dealer-shell.tsx` (before `<UnreadBell>`), `src/styles/accessibility.css` (the `body:has(.a11y-trigger--header) .a11y-trigger--floating { display: none }` rule)

**Interfaces:**
- Consumes: `readPrefs`, `writePrefs`, `applyPrefs`, `A11Y_DEFAULTS`, `A11yPrefs` (Task 1).
- Produces: `AccessibilityMenu({ variant }: { variant: "header" | "floating" })`; trigger classes `a11y-trigger a11y-trigger--header|--floating`.

- [ ] **Step 1: Build the component.** Trigger: `<button aria-expanded aria-controls aria-label="Accessibility">` with lucide `PersonStanding`; header variant shows the word "Accessibility" from 768 px. Panel: `role="dialog" aria-label="Accessibility settings"` (not modal); text size as a radio group (Normal / Large / Extra large); three switches (`role="switch" aria-checked`) labelled "High contrast", "Reduce motion", "Readable font"; "Reset to default" button. Every change → `applyPrefs(document.documentElement, p)` + `writePrefs(p)`. State initialises from `readPrefs()` on open. Esc / outside click closes and returns focus to the trigger. Under 640 px the panel is a bottom sheet. Floating trigger: fixed bottom-left, 44×44, `z-index` above page content but below dialogs already in the app.
- [ ] **Step 2: Place it** in the three files above.
- [ ] **Step 3: Verify** `npx tsc --noEmit` clean and `npm test` green.
- [ ] **Step 4: Commit** `feat(a11y): accessibility menu on every portal`.

### Task 4: Route faint colours through variables

**Files:**
- Modify: the CSS files reported by the contrast scan (29 files; e.g. `src/components/messaging/messaging.css`, `src/app/dealer/dealer-stock-reporting.css`, `src/app/dealer/dealer-portal.css`, `src/app/intelligence/retail/retail-users.css`, `src/app/intelligence/retail/staff-orders.css`, `src/app/intelligence/login/login.css`, …)
- Create (scratch, not committed): `<scratchpad>/a11y/swap-faint.py`

**Interfaces:**
- Consumes: the three variables from Task 2.

- [ ] **Step 1: Write the swap script.** For each `color:` declaration (not `background-color`, not `border-color`) whose value is a hex below 4.5:1 on white and above 1.6:1: greys → `var(--tri-text-faint, <hex>)`, greens → `var(--tri-text-faint-green, <hex>)`, golds/yellows → `var(--tri-text-faint-gold, <hex>)`; light blues (`#93c5fd`, `#7eb8ff`, `#7eb0ff`) and anything inside a rule whose selector matches `hero|dark|--dark|sidebar|ri-shell` are left alone. Print a per-file count.
- [ ] **Step 2: Run it** and review `git diff --stat`; spot-read 3 files. Expected: ~150–180 replacements, every replacement keeps the original hex as fallback.
- [ ] **Step 3: Handle the TSX stragglers** — the 1 `text-slate-400` and the inline `style={{ color: "#…" }}` values that are faint → same variables.
- [ ] **Step 4: Verify** `npm test` green; `next build` succeeds.
- [ ] **Step 5: Commit** `feat(a11y): faint text colours follow the high-contrast setting`.

### Task 5: Browser verification and fixes

**Files:**
- Create (scratch): `<scratchpad>/a11y/check.mjs` (Playwright Chromium at `~/.cache/ms-playwright/chromium-1140/chrome-linux/chrome`, `LD_LIBRARY_PATH=$S/chromelibs/root/usr/lib/x86_64-linux-gnu`; inject `node_modules/axe-core/axe.min.js`)
- Modify: whatever the checks find.

- [ ] **Step 1: Stress build** of this branch on `tri_stress` (`.env` copied with `RESEND_API_KEY=""`, `ODOO_MODE=mock`, `ODOO_API_KEY=""`), `next build && next start -p 3998`.
- [ ] **Step 2: Normal mode identical:** screenshot login, dealer dashboard, staff orders, messages on main's build and this branch at 1280; pixel diff = 0 (or only the new trigger's area).
- [ ] **Step 3: Sweep** pages from spec §6 at 390/768/1280/1440 with `tri-a11y` set to Extra large: no `scrollWidth > clientWidth` on `<html>`, header nav not clipped, panel fits the viewport. Only one `.a11y-trigger` visible per page.
- [ ] **Step 4: axe** with contrast on, rules `color-contrast` only: zero violations on the §6 pages. Fix leftovers in CSS and re-run until zero.
- [ ] **Step 5: Persistence/no-flash:** set prefs, reload, read `document.documentElement` attributes in the first `DOMContentLoaded` — present. Keyboard: Tab to trigger, Enter, change each control, Esc → focus back on trigger. `localStorage` blocked (context with `storageState` denied via `page.addInitScript` overriding `localStorage` to throw) → page renders, menu toggles.
- [ ] **Step 6: Full suites:** `npm test`, `npm run test:db` (tri_test), `npx tsc --noEmit`, `next build`. Commit fixes `fix(a11y): …`.
- [ ] **Step 7: Final whole-branch review** (fresh reviewer, most capable model), fix Critical/Important with a test each, PR text to `D:\Downloads\pr-accessibility-menu.md` (no attribution lines).
