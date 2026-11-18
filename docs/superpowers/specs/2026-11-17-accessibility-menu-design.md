# Accessibility menu — design

**Status:** design approved in chat by Adrian (16–17 Nov 2026). Branch `feat/accessibility`, its own PR.
**Out of scope:** saving choices to the user's account, screen-reader audit of every page, a dark mode.

## 1. What and why

Any visitor — dealer, staff, depot, or someone on a login page — can make the portal easier to read on their own device. Four settings:

| Setting | Values | Effect |
|---|---|---|
| Text size | Normal · Large · Extra large | Root size × 1 · 1.15 · 1.3. All text and spacing are in `rem` from `--tri-root-font`, so everything scales together. |
| High contrast | Off · On | Faint greys and pale status colours become dark enough for WCAG AA (4.5:1 text, 3:1 borders and icons); stronger focus outline. Brand colours stay. |
| Reduce motion | Off · On | Animations, transitions, smooth scroll and the hero image zoom stop. Also applies automatically when the device asks for reduced motion. |
| Readable font | Off · On | Century Gothic is replaced by Verdana (installed on every PC and phone, no download) with `letter-spacing: 0.02em` and `word-spacing: 0.08em`. |

## 2. Where the button is

- **Dealer and staff portals:** an "Accessibility" button (person icon, label visible from tablet width, `aria-label` always) in the header, next to notifications.
- **Every other page** (login and access pages, depot, Note Taker, Presentations, Admin pages, password pages): a round floating button, bottom-left, rendered once from the root layout.
- When a header button is on the page, the floating one is hidden by one CSS rule: `body:has(.a11y-trigger--header) .a11y-trigger--floating { display: none }`.

The button opens a small panel (popover on desktop, bottom sheet on phones under 640px) with the four controls as labelled radio groups / switches and a "Reset to default" link. Esc or a click outside closes it and returns focus to the button. It is not a modal, so focus is not trapped.

## 3. How choices are stored and applied

- Stored in `localStorage` under one key, `tri-a11y`, as `{ "text": "normal|large|xlarge", "contrast": bool, "motion": bool, "font": bool }`. Unknown or broken values fall back to defaults. Every read and write is in `try/catch` (private windows can throw).
- Applied as attributes on `<html>`: `data-a11y-text="large|xlarge"`, `data-a11y-contrast`, `data-a11y-motion="reduce"`, `data-a11y-font="readable"`. Default values set no attribute.
- **No flash:** a tiny inline script in `<head>` of `src/app/layout.tsx` reads the key and sets the attributes before first paint. The React panel reads and writes the same key through one module, `src/lib/a11y/preferences.ts` (parse, serialise, apply), so script and panel can't drift: the inline script is generated from that module's `applyScript` string.
- All CSS lives in one new file, `src/styles/accessibility.css`, imported by `globals.css`.

## 4. High contrast — how the faint colours are reached

Measured 17 Nov: 209 text colour declarations across 29 CSS files are below 4.5:1 on white. Only 41 go through variables; `#94a3b8` alone is 102 of them.

1. **Mechanical swap (no visual change in normal mode):** in light areas, each faint grey becomes a shared variable with the old value as fallback, e.g. `color: #94a3b8` → `color: var(--tri-text-faint, #94a3b8)`. Three variables cover the families: `--tri-text-faint` (greys), `--tri-text-faint-green`, `--tri-text-faint-gold`. The existing per-area muted variables (`--msg-muted`, `--ri-muted`, `--tri-muted-soft`, `--ru-multi-muted`, `--ro-muted`) are redefined under high contrast too.
2. Colours on dark backgrounds (heroes, the old dark shell) are left alone: they already read as light-on-dark.
3. `html[data-a11y-contrast]` redefines the variables to AA values (greys → `#475569`, green → `#047857`, gold → `#8a6100`), darkens default borders, and sets `:focus-visible { outline: 3px solid #1e3a8a; outline-offset: 2px }`.
4. Tailwind `text-slate-400` (1 use) and the 15 inline `style={{ color }}` values are checked and moved to the same variables where faint.
5. **axe-core** (already installed) run with high contrast on catches whatever the swap missed; those are fixed until axe reports no colour-contrast failures on the pages in §6.

## 5. Other details

- Text size multiplies the existing token, so the clamp() bands per screen width keep working: `html[data-a11y-text="large"] { font-size: calc(var(--tri-root-font) * 1.15) }`.
- Reduce motion: `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important` for `*, ::before, ::after`, under both the attribute and `@media (prefers-reduced-motion: reduce)`.
- Readable font overrides `--font-sans` and any `font-family` set directly to Century Gothic.
- Fixed-px layouts that break at Extra large are fixed where found (no sideways scroll is the rule).

## 6. Testing

- **Unit (first):** `preferences.ts` — parse defaults, garbage, partial objects; serialise round-trip; the attribute set for each combination; `localStorage` throwing.
- **Browser checks** on the stress build, each with the menu driven like a user:
  - pages: login, dealer dashboard, place order, dealer stock reporting, staff home, staff orders, messages, support, users, depot dashboard;
  - widths 390, 768, 1280, 1440; Extra large text → no sideways scroll, nothing clipped in the header;
  - high contrast on → axe: zero `color-contrast` violations on those pages;
  - reload → choices persist, no flash (attributes present in the first HTML paint);
  - keyboard only: open, change every control, Esc, focus returns.
- `npm test`, `npm run test:db`, `tsc`, `next build` before claiming done.

## 7. Acceptance

- Normal mode looks pixel-identical to main (spot-check screenshots before/after on 4 pages).
- Each of the four settings visibly works on every portal and on the login pages, persists across reloads on that device, and can be reset.
- High contrast passes axe colour-contrast on the listed pages.
