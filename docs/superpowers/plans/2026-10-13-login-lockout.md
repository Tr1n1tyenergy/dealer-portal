# Login Lockout and Reset Limits (E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock an email after repeated wrong passwords (and an IP that sprays many emails), make every login refusal take the same time, and cap password-reset emails.

**Architecture:** A database attempt log (`AuthAttempt`) counted over sliding windows, behind a small server module (`auth-throttle.ts`). `authorize()` checks the lock first, records failures, clears on success. A client-safe module formats the lock message for the login screens.

**Tech Stack:** NextAuth v4 credentials provider, Prisma 6 / PostgreSQL, bcryptjs, `node:test` + tsx.

**Spec:** `docs/superpowers/specs/2026-10-13-login-lockout-design.md`

## Global Constraints

- Limits (verbatim): login per email 5 failures / 15 min; login per IP 30 failures / 15 min; reset per email 3 / 60 min; reset per IP 10 / 60 min.
- Lock message: `Too many sign-in attempts. Try again in <n> minutes, or reset your password.` — `<n>` = ceil(seconds/60), minimum 1; `1 minute` singular.
- Lock checked before the password; locked attempts are not recorded; unknown emails count; success deletes that email's `LOGIN_FAILURE` rows only.
- Client IP: first `x-forwarded-for` entry (trimmed), else `x-real-ip`, else `"unknown"`.
- Dummy bcrypt hash uses cost 12.
- Rows older than 24 h are deleted on each write.
- Migration is additive; created with `prisma migrate diff --from-url <tri_test> --to-schema-datamodel prisma/schema.prisma --script` (non-interactive), applied to `tri_test` and `tri_dev` with `migrate deploy`.
- Portals: Admin/Staff, Dealer, Depot logins; staff forgot-password.

## Review Focus

1. Five failures arriving at the same instant → still locked afterwards (record first, then count). Test in Task 2.
2. Email typed with different case/spaces (`" Owner@X.com "`) counts toward the same lock as `owner@x.com`. Test in Task 2.
3. A lock on one email must not affect a different email from the same IP below the IP cap. Test in Task 2.
4. `x-forwarded-for` with several entries (`"1.2.3.4, 10.0.0.1"`) → `1.2.3.4`. Test in Task 1.
5. The forgot-password response is identical whether allowed, rate-limited, or the account doesn't exist. Checked in Task 4's live probe.

---

### Task 1: Lock message and IP helpers (client-safe)

**Files:**
- Create: `src/lib/security/login-errors.ts`, `src/lib/security/client-ip.ts`
- Test: `src/lib/security/login-errors.test.ts`
- Modify: `package.json` (`"test"`)

**Interfaces:**
- Produces: `LOCKED_PREFIX = "LOCKED:"`; `lockedError(retryAfterSeconds: number): string`; `loginErrorMessage(error: string | null | undefined, fallback: string): string`; `clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string`.

- [ ] **Step 1: Failing tests** — `loginErrorMessage(lockedError(600), "x")` → `"Too many sign-in attempts. Try again in 10 minutes, or reset your password."`; 61 s → `2 minutes`; 30 s and 60 s → `1 minute`; `"CredentialsSignin"` → fallback; `null` → fallback. `clientIp` with `{"x-forwarded-for": "1.2.3.4, 10.0.0.1"}` → `"1.2.3.4"`; with a `Headers` object holding `x-real-ip: 5.6.7.8` → `"5.6.7.8"`; with `{}` / `undefined` → `"unknown"`.
- [ ] **Step 2: Run** `node --import tsx --test src/lib/security/login-errors.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** both modules (no server imports).
- [ ] **Step 4: Run** → PASS; add to `"test"`; `npm test` all pass.
- [ ] **Step 5: Commit** `feat(auth): lock message and client IP helpers`

### Task 2: AuthAttempt table and throttle service

**Files:**
- Modify: `prisma/schema.prisma` (enum `AuthAttemptKind { LOGIN_FAILURE PASSWORD_RESET }`, model `AuthAttempt` with `id String @id @default(cuid())`, `kind`, `email String`, `ip String`, `createdAt DateTime @default(now())`, `@@index([kind, email, createdAt])`, `@@index([kind, ip, createdAt])`)
- Create: `prisma/migrations/20261013150000_auth_attempts/migration.sql`
- Create: `src/lib/security/auth-throttle.ts`
- Test: `src/lib/security/auth-throttle.db.test.ts` (same `_test` guard style as `src/lib/orders/depot-access.db.test.ts`; unique emails/IPs per run; cleanup by those values)
- Modify: `package.json` (`"test:db"`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `normalizeEmail(email: string): string`; `checkLoginLock(email: string, ip: string): Promise<{ locked: false } | { locked: true; retryAfterSeconds: number }>`; `recordLoginFailure(email: string, ip: string): Promise<void>`; `clearLoginFailures(email: string): Promise<void>`; `allowPasswordReset(email: string, ip: string): Promise<boolean>`. Exported constants `LOGIN_EMAIL_LIMIT = 5`, `LOGIN_IP_LIMIT = 30`, `LOGIN_WINDOW_MS = 15 * 60_000`, `RESET_EMAIL_LIMIT = 3`, `RESET_IP_LIMIT = 10`, `RESET_WINDOW_MS = 60 * 60_000`.
  Retry time: the window end measured from the oldest failure among the most recent `limit` failures (`retryAfterSeconds = ceil((that.createdAt + window − now) / 1000)`), the larger of the email and IP results. `allowPasswordReset` counts first, records only when allowed.

- [ ] **Step 1: Schema + migration** — add the model/enum; generate SQL with `migrate diff` against `tri_test`; save as the migration; `migrate deploy` on `tri_test`; `npx prisma generate`.
- [ ] **Step 2: Failing tests**
  - `does not lock after four failures`
  - `locks an email on the fifth failure` → `locked: true`, `retryAfterSeconds` between 1 and 900
  - `counts differently-cased emails together` (Review Focus 2)
  - `locks after five simultaneous failures` (`Promise.all` of 5 records; Review Focus 1)
  - `unlocks once failures are older than the window` (back-date rows 16 min via `prisma.authAttempt.updateMany`)
  - `clears an email's failures after a successful login` (`clearLoginFailures` → not locked)
  - `blocks an IP after 30 failures across different emails`; a fresh email from that IP is locked
  - `does not lock another email from the same IP below the IP cap` (Review Focus 3)
  - `allows three reset emails per address per hour, then refuses`
  - `allows ten reset requests per IP per hour, then refuses`
  - `deletes attempts older than 24 hours on write`
- [ ] **Step 3: Run** `node --env-file-if-exists=.env.test.local --import tsx --test src/lib/security/auth-throttle.db.test.ts` → FAIL (module not found).
- [ ] **Step 4: Implement** `auth-throttle.ts`.
- [ ] **Step 5: Run** → PASS; add to `"test:db"`; `npm run test:db` all pass; apply the migration to `tri_dev` (`npx prisma migrate deploy`, local `.env`).
- [ ] **Step 6: Commit** `feat(auth): attempt log and throttle service`

### Task 3: Wire into login, forgot-password and the login screens

**Files:**
- Modify: `src/lib/auth.ts` (`authorize`)
- Modify: `src/app/api/auth/forgot-password/route.ts`
- Modify: `src/components/access/portal-login.tsx:121`, `src/app/intelligence/login/page.tsx:84`

**Interfaces:**
- Consumes: Task 1 (`lockedError`, `loginErrorMessage`, `clientIp`), Task 2 (`normalizeEmail`, `checkLoginLock`, `recordLoginFailure`, `clearLoginFailures`, `allowPasswordReset`).

- [ ] **Step 1: `authorize(credentials, req)`** — `ip = clientIp(req?.headers)`; lock check first (`throw new Error(lockedError(s))`); every refusal path (missing user, no hash, disabled/pending, wrong portal, wrong password) calls `recordLoginFailure` then returns `null`; unknown user / no hash runs `bcrypt.compare(password, DUMMY_HASH)` first, where `DUMMY_HASH` is a module constant created once with `bcrypt.hashSync("tri-dummy-password", 12)`; success calls `clearLoginFailures` before the existing updates.
- [ ] **Step 2: Forgot-password** — after normalizing the email: `if (!(await allowPasswordReset(email, clientIp(req.headers)))) return NextResponse.json(GENERIC_OK);`
- [ ] **Step 3: Screens** — `setError(loginErrorMessage(result.error, "<existing message>"))` in both files.
- [ ] **Step 4: Verify** `npx tsc --noEmit`, `npm run lint` (no new warnings), `npm test`, `npm run test:db`, `npm run build`.
- [ ] **Step 5: Commit** `fix(auth): lock repeated failed logins and cap reset emails (E1)`

### Task 4: End-to-end check

- [ ] **Step 1:** Production build of the branch in the scratch copy against a `pg_dump` copy of `tri_dev` (+ `migrate deploy`) on :3995, with `RESEND_API_KEY` removed from the copy's `.env`.
- [ ] **Step 2:** HTTP probe per portal (staff, dealer, depot test accounts): 5 wrong passwords → 6th try with the **correct** password is refused with the `LOCKED:` error; a different account from the same IP still logs in; unknown-email vs real-email-wrong-password median times within ~100 ms; forgot-password returns identical bodies for 5 requests and only 3 `PASSWORD_RESET` rows exist for that email.
- [ ] **Step 3:** User sees the lock message on a login screen in the browser.
- [ ] **Step 4:** Clean up (stop server by port PID, drop probe DB, delete scratch copy); push/PR commands with the deploy note (`migrate deploy` on staging and production).
