# Initial cases resolved

Status of the issues found while reviewing, stress-testing and setting up the
PostgreSQL version of the dealer portal (8 October 2026). The finding IDs (E2, F1,
C5, …) match the stress-test reports: *Dealer Portal Stress Test & Debugging
Report* (SQLite) and *PostgreSQL Stress Test*.

## Fixed on this branch

### SQLite → PostgreSQL transfer lost every date

`scripts/transfer-sqlite-to-postgres.ts` — `toDate()`

- **What was wrong:** every copied date came out wrong. Required dates
  (`createdAt` / `updatedAt` on users, dealers, stations, orders, depot, settings,
  activity log) became the time of the transfer. Optional dates such as
  `User.lastLoginAt` became `NULL`.
- **Why:** Prisma's SQLite connector stores `DateTime` as integer epoch
  milliseconds, but `toDate()` parsed every value with `new Date(String(value))`.
  `new Date("1791370225439")` is `Invalid Date`, so `requireDate()` fell back to
  "now" and optional fields to `null`.
- **Fix:** numbers, bigints and all-digit strings are now converted with
  `new Date(Number(value))`. ISO strings keep the existing path. All 45 call sites
  go through this one function.
- **Verified:** every `DateTime` value in the SQLite source was compared with the
  PostgreSQL copy. Before the fix, 129 of 175 were wrong; after it, 0 of 175 were
  wrong (fresh database, `prisma migrate deploy` + transfer, on top of #2).
- **Why it was missed:** `scripts/validate-staging-data.ts` only compares row
  counts, and its expected counts are hardcoded from one developer's database
  (`DealerOrder: 15`, `ActivityLog: 113`). On any other source it reports false
  "Count mismatches", and it cannot detect wrong column values.

> **Action for staging:** Neon staging was probably loaded with the unfixed
> script. If its `createdAt` values all equal the transfer time, re-run the fixed
> transfer against staging with `--force` (after team approval).

## Resolved by the PostgreSQL migration

| ID | Finding | Result on PostgreSQL |
| --- | --- | --- |
| F1 | One order of more than 2,147,483,647 litres crashed the staff Dealer Operations page for every user (SQLite stored the value; Prisma could not read it back). | PostgreSQL rejects the value at insert, so the page and both dealer dashboards stay up. The input is still unvalidated; see P4 below. |

## Addressed in #2 (code-reviewed, not yet re-tested)

| ID | Finding | What #2 changed |
| --- | --- | --- |
| E2 | Anyone could reset the super admin's password: `forgot-password` returned the reset link when `RESEND_API_KEY` was unset. | The route always returns `{ ok: true }` and never returns links. Without an email provider it issues no token. Invite links are only returned outside production with `TRI_EXPOSE_DEV_AUTH_URLS=1`. |
| D2 | Disabled users kept access for up to 30 days, because JWT sessions were never re-checked. | `hydrateTokenFromUser()` re-reads the user, and middleware rejects `SessionRevoked` tokens. |

These should be re-run through the stress-test harness before being marked verified.

## Still open

Reproduced on the PostgreSQL version. Reproduction steps, root causes and
suggested fixes are in the stress-test reports.

| ID | Severity | Finding | Where |
| --- | --- | --- | --- |
| A2 | High | Dealer and depot accounts can call staff-only APIs | `src/lib/api-auth.ts` |
| C1 | High | "Generate PFI" failure strands the order in `PFI_PENDING` with no retry | `src/lib/orders/service.ts` |
| C3 | High | Rejected payment is a dead end; each retry leaves an orphan payment record | `src/lib/orders/service.ts` |
| C5 | High | Concurrent "Confirm payment" clicks are all applied | `src/lib/orders/service.ts` |
| C6 | High | Concurrent "Release to depot" clicks are all applied | `src/lib/orders/service.ts` |
| C9 | High | A depot manager can act on another depot's orders | `src/lib/orders/actions.ts` |
| E1 | High | No brute-force protection on login | `src/lib/auth.ts` |
| A1 | Medium | Logged-out users land on NextAuth's default sign-in page, not `/access` | `src/middleware.ts` |
| B1 | Medium | Malformed requests crash with HTTP 500 | `src/app/api/*` |
| C4 | Medium | Payment amount is free text (negative / non-numeric accepted) | `src/lib/orders/actions.ts` |
| C7 | Medium | Double-clicking "Place order" creates duplicate orders | `src/lib/orders/service.ts` |
| D1 | Medium | Deleting a user who has placed orders crashes | `src/app/api/users/[id]/route.ts` |
| G1 | Medium | The only super admin can demote themselves | `src/app/api/users/[id]/route.ts` |
| B2 | Low | No size limits on text fields and arrays | `src/app/api/reports/route.ts` |
| C8 | Low | Delivery date not validated (invalid crashes, past accepted) | `src/lib/orders/service.ts` |
| C10 | Low | Unknown depot action crashes with a TypeError | `src/lib/orders/service.ts` |
| D3 | Low | Finance / Sales Rep roles cannot be assigned from the admin screen | `src/app/api/users/route.ts` |
| P2 | Low | Report search became case-sensitive on PostgreSQL (`contains` needs `mode: "insensitive"`) | `src/app/api/reports/route.ts` |
| P4 | Low | An oversized quantity returns a raw 500 instead of a validation message | `src/lib/orders/actions.ts` |

## Checked and ruled out

- **P1:** simultaneous first orders of a year do not collide on order numbers on
  PostgreSQL. Five concurrent orders against an empty `OrderSequence` received
  `DO-2026-000001` to `000005`.
- **P3:** 60 concurrent loads of Dealer Operations ran with no connection-pool
  errors (local PostgreSQL 16, default Prisma pool).

## Local development notes

- If `next dev` is running, a `next build` in the same folder overwrites the dev
  server's `.next` output and the route manifest, which causes false 404s. Build
  in a separate copy, or stop the dev server first.
- `validate-staging-data.ts` count mismatches are expected for any database other
  than the one its constants came from. Compare against the source SQLite file
  instead.
