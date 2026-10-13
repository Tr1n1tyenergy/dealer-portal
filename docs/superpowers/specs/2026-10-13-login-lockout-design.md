# Login lockout and reset limits (E1) — design

Date: 2026-10-13 · Portals: **Admin/Staff, Dealer and Depot logins**, plus staff forgot-password · Branch: `fix/login-lockout`

## Problem

`authorize()` in `src/lib/auth.ts` has no limit on failed attempts, so passwords can be guessed without end on all
three portals. Two related gaps are fixed with it:
- an unknown email returns at once while a real one runs bcrypt (~250 ms), so response time reveals which emails
  have accounts;
- `POST /api/auth/forgot-password` sends an email on every request, so an inbox can be flooded and the Resend quota
  burned.

Production runs on Vercel serverless, so counters must live in the database (memory is per instance).

## Rules

| Limit | Key | Threshold | Window | Effect |
|---|---|---|---|---|
| Login, per email | normalized email (lowercase, trimmed) | 5 failures | 15 min | email locked |
| Login, per IP | client IP | 30 failures | 15 min | IP blocked |
| Reset, per email | normalized email | 3 requests | 60 min | no further emails |
| Reset, per IP | client IP | 10 requests | 60 min | no further emails |

- A lock is checked **before** the password: while locked, even the correct password is refused.
- Refused (locked) attempts are not recorded, so a lock ends 15 min after the last counted failure.
- Unknown emails are counted exactly like real ones (no hint that an account exists).
- A successful login deletes that email's login failures. IP failures are not cleared.
- Wrong portal, disabled, pending, missing password hash and wrong password all count as failures.
- Client IP: first entry of `x-forwarded-for`, else `x-real-ip`, else `"unknown"` (all unknown-IP requests share
  one bucket; acceptable locally, Vercel always sets the header).

## What people see

- Locked email or blocked IP, all three login screens:
  `Too many sign-in attempts. Try again in <n> minutes, or reset your password.` (`<n>` rounded up, minimum 1;
  "1 minute" singular).
- Ordinary wrong password: unchanged messages.
- Forgot-password over the limit: unchanged generic success response; no email is sent and no token is created.

## Equal-time responses

When the email is unknown or has no password hash, `authorize()` still runs `bcrypt.compare` against a fixed dummy
hash (cost 12, same as real hashes) before returning, so every refusal takes about the same time.

## Components

### Database — `AuthAttempt` (new table, additive migration)
`id` (cuid), `kind` (enum `AuthAttemptKind`: `LOGIN_FAILURE`, `PASSWORD_RESET`), `email` (string),
`ip` (string), `createdAt` (default now). Indexes: `(kind, email, createdAt)`, `(kind, ip, createdAt)`.
Rows older than 24 h are deleted on each write.

### `src/lib/security/auth-throttle.ts` (server)
- `clientIp(headers): string`
- `checkLoginLock(email, ip): Promise<{ locked: false } | { locked: true; retryAfterSeconds: number }>`
- `recordLoginFailure(email, ip): Promise<void>`
- `clearLoginFailures(email): Promise<void>`
- `allowPasswordReset(email, ip): Promise<boolean>` — records the request when allowed.
- Retry time = end of the window measured from the oldest failure that still counts toward the limit.

### `src/lib/security/login-errors.ts` (client-safe)
- `LOCKED_PREFIX = "LOCKED:"`; `lockedError(seconds)` → `"LOCKED:<seconds>"`;
  `loginErrorMessage(error, fallback)` → the lock sentence above for `LOCKED:` errors, otherwise `fallback`.

### `src/lib/auth.ts`
`authorize(credentials, req)`: normalize email → `checkLoginLock` (locked → `throw new Error(lockedError(s))`) →
user/portal/status checks with dummy bcrypt on unknown/no-hash → on any refusal `recordLoginFailure` and return
`null` → on success `clearLoginFailures`, then the existing `lastLoginAt` update and `USER_LOGIN` log.

### `src/app/api/auth/forgot-password/route.ts`
After parsing the email: `allowPasswordReset(email, ip)`; when false return the existing generic success
immediately.

### Login screens
`src/components/access/portal-login.tsx` (dealer, depot) and `src/app/intelligence/login/page.tsx` (staff) show
`loginErrorMessage(result.error, <existing message>)`.

## Testing

- Unit (`login-errors.test.ts`): message formatting (minutes rounding, singular, fallback); `clientIp` header
  parsing.
- Database (`auth-throttle.db.test.ts`, `tri_test` only): 4 failures not locked, 5th locks (the correct
  password being refused while locked is checked in the live probe, since it happens in `authorize()`); lock lifts once failures age past 15 min (rows back-dated); success clears
  the email; 30 failures from one IP across different emails block that IP; unknown-email failures count; reset
  allows 3 per email per hour then refuses; reset IP cap 10.
- Live probe on a production build (tri_dev copy, `RESEND_API_KEY` removed from the copy): 5 wrong passwords then
  the correct one is refused with the lock message on each portal; another email still logs in; timing of unknown
  vs real email within ~100 ms; forgot-password returns the generic response every time.

## Deploy note

New table: run `prisma migrate deploy` on staging and production before this code goes live (same as C7).

## Out of scope

Admin view of lockouts, manual unlock, CAPTCHA, lockout for the dealer/depot activation and reset-password token
endpoints (tokens are 256-bit random).
