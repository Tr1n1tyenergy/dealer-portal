# Brand Loaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Replace the ring loader with three brand loaders: a sign-in splash, a portal orbit and a page skeleton.
**Spec:** `docs/superpowers/specs/2026-11-24-brand-loaders-design.md`

## Global Constraints
- Brand colours: warm #ffca05 → #ed1c24, cool #3853a4 → #2dc0d1.
- Century Gothic (`century-gothic.css`).
- Respect reduced motion.
- No text under 12px.
- No Co-Authored-By trailer.

## Review Focus
1. A programmatic navigation (`router.push`, with no click) must still show the page skeleton.
2. The splash must never show twice for one sign-in, and must never get stuck (4 s cap, and a click skips it).
3. A link to the same portal must not show the orbit.
4. The splash must not block a screen reader. It needs `role="status"`, and the page behind it can't be left `inert` after it closes.
5. No sideways scrolling at 390px.

### Task 1: Loader routing logic (TDD)
- **`src/lib/ui/loader-routes.ts`:** `portalKey(pathname)`, `loaderFor(fromPath, toPath): "portal" | "page"`, `destinationLabel(pathname)`, plus `markSplashPending(storage)` and `takeSplash(storage)`.
- **Tests:** `src/lib/ui/loader-routes.test.ts`.

### Task 2: Components and wiring
- **New:** `brand-loaders.tsx/.css` (`TrinityMark`, `PageLoader`, `PortalLoader`) and `sign-in-splash.tsx`.
- **`ViewChangeLoader`:** passes the loader kind and label.
- **Use the new loaders in:**
  - `route-loading.tsx` and the `loading.tsx` files;
  - the 2 Suspense fallbacks;
  - `PortalLogin` (marks the splash);
  - `layout.tsx` (mounts the splash).
- **Delete** the old loader.

### Task 3: Checks and review
- `tsc`, lint, `npm test`, `npm run test:db`.
- Browser check on Chromium, Firefox and WebKit:
  - the splash after sign-in;
  - the orbit from Modules → Retail;
  - the skeleton for Orders → Analytics;
  - reduced motion;
  - phone width.
- Fresh review, then the PR text and PR page.
