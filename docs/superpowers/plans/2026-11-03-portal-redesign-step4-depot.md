# Portal redesign step 4 (depot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The depot loading board becomes the depot's E2 home: the tanker photo with the depot name and one sentence of what to do, then the four queues as clean lists with their action forms.

**Architecture:** `PhotoHero` (step 3) on top; one tested helper for the sentence; queues on `.ui-panel` with `.ui-field`/`.ui-input` forms. The old `.portal*` rules leave `dealer-portal.css` for a small `depot.css`.

**Tech Stack:** Next.js 15, CSS tokens, node:test, Playwright-core.

**Spec:** `docs/superpowers/specs/2026-11-02-portal-redesign-design.md` §5 depot home, §8 step 4

## Global Constraints

- Same branch `feat/portal-redesign`; no attribution lines; nothing pushed until this step is reviewed.
- Behaviour unchanged: the same query (`depotOrderScope`), the same `depotOrderAction` form fields (`orderId`, `action` = accept/complete/dispatch/deliver, `truckRegistration`, `driverName`, `loadedPmsLitres`, `loadedAgoLitres`, `loadingReference`, `deliveryNoteRef`) and limits (`maxLength 500`, `MAX_LITRES`).
- One yellow button per order row (its next step); tokens only; no small all-caps; no sideways scroll at 390px.

## Review Focus

1. A depot user with no `depotId`: the board is empty with "Nothing to load right now." and no errors.
2. Long dealer and station names at 390px: rows wrap, the forms stay usable, and there is no sideways scroll.
3. The loaded-litres inputs keep `type="number"`, `min=0`, `max=MAX_LITRES` and `step=1`.

Line 1 is pinned by the Task 1 unit test (all zero gives that sentence), line 2 by the Task 2 browser check, and line 3 is checked in the diff review.

---

### Task 1: Depot home

**Files:** Create `src/lib/depot/board-summary.ts` + `.test.ts` (in the `test` list); modify `src/app/depot/dashboard/page.tsx`; create `src/app/depot/dashboard/depot.css`; delete the `.portal*` rules from `src/app/dealer/dealer-portal.css` and the page's import of that file.

**Interfaces:** `depotBoardSentence(counts: { toLoad: number; loading: number; toDispatch: number; onTheRoad: number }): string` gives the non-zero parts joined by " · ", in that order:
- "{n} to load";
- "{n} loading";
- "{n} ready to dispatch";
- "{n} on the road".

With all four at zero it gives "Nothing to load right now."

- [ ] Step 1: Tests:
  - `{ toLoad: 2, loading: 0, toDispatch: 1, onTheRoad: 0 }` → "2 to load · 1 ready to dispatch";
  - all four at zero → "Nothing to load right now.";
  - all four non-zero → "1 to load · 2 loading · 3 ready to dispatch · 4 on the road".

  Run: FAIL (module missing).
- [ ] Step 2: Implement; run: PASS.
- [ ] Step 3: Page:
  - `PhotoHero` with image `/assets2/img/access/depot-tanker.jpg`, place = the depot's name (the first order's `depot.name`, otherwise "Depot"), title `{nairobiGreeting()}, {firstName}`, and the sentence.
  - Below, in `.ui-page`: the four queues ("Ready to load", "Loading", "Ready to dispatch", "On the road"), each a `.ui-panel` with a count chip.
  - Each order is a list row: reference (bold), dealer · station, fuel, then its form. Fields use `ui-field`, inputs use `ui-input`, and the action is `ui-btn--primary`.
  - Empty "Ready to load" says "Nothing to load right now."; the other empty queues say "Nothing here right now."
- [ ] Step 4: tsc, eslint, unit. Commit `feat(depot): loading board as the depot's E2 home`.

### Task 2: Check, screenshots, PR text for the whole redesign

- [ ] Step 1: Build. Run the depot pages at 1440/768/390 for `depot@trinityenergyltd.com`, checking for sideways scroll, a light ground, one `h1` and no small all-caps; take screenshots. Then run every earlier check again.
- [ ] Step 2: Unit, DB, tsc, eslint, build.
- [ ] Step 3: Screenshots to `D:\Downloads\portal-redesign-step4-screens\`. Write one PR text for the whole redesign, `D:\Downloads\pr-portal-redesign.md`: steps 1–4, the chart, tests, and the not-checked list.
- [ ] Step 4: Commit any fixes. Then the final review of this step's commits, and the push command for Adrian.
