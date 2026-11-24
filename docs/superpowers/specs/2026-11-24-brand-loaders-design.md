# Brand loaders: splash, portal orbit, page skeleton

**Status:** approved by Adrian, 24 Nov 2026 (picks 11, 8 and 9 from `loader-trinity-mark-2026-11-24.html`; the designer approved use of the artwork) · **Size:** small change

## Why
Today's loader (#88/#89) shows a full-screen ring spinner and a progress bar that fills on a timer for every navigation. Adrian chose three Trinity-mark loaders, one for each moment.

## Design
- **Sign-in splash (mockup 11):**
  - When: after a successful sign-in on any portal (staff, dealer, depot). `PortalLogin` sets a one-time `sessionStorage` flag before it redirects.
  - What: the designer's artwork, then "Welcome back, *first name*" and "Opening your workspace".
  - Timing: at least 1.2 s, gone as soon as the page has loaded, and never longer than 4 s. A click or Esc skips it. Taking the flag clears it, so it shows once per sign-in.
- **Portal orbit (mockup 8):** when a click changes portal or module. The portal is decided by the first path segment under `/intelligence` (dashboard, retail, note-taker, presentations, admin), or by `/dealer` or `/depot`. It shows "Opening *Retail*".
- **Page skeleton (mockup 9):** every other page change, plus the `loading.tsx` and Suspense fallbacks. A warm-and-cool line runs under the header over a grey page skeleton, labelled "Loading *Orders*".
- **What stays:** `ViewChangeLoader`'s detection (click capture, fetch watch, history commit). It now picks the loader and the label from the target URL.
- **What goes:** `trinity-workspace-loader.tsx/.css` and `trinity-mark.svg`. The mark is drawn inline (three parts, brand gradients).
- **Reduce motion:** every loader shows a still frame.
- **Asset:** `public/assets2/img/brand/trinity-splash.webp`, at 900 px and about 64 KB.

## Not doing
- No real per-request progress.
- No change to when the overlay starts or stops.
