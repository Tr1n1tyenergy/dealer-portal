# Hash Login Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** The database stores only SHA-256 hashes of invite and reset tokens.
**Architecture:** `hashToken()` is used at every write and lookup. A one-off SQL migration hashes the existing rows. A guard test stops plain-token use creeping back.
**Spec:** `docs/superpowers/specs/2026-11-20-hash-login-tokens-design.md`

## Global Constraints
- The emailed URL format (`?token=<64 hex>`) is unchanged.
- No Co-Authored-By trailer.
- Run `npm test` + `npm run test:db`.

## Review Focus
1. **A link emailed before deploy (a plain row hashed by the migration)** still activates. (Task 2 DB test runs the migration SQL.)
2. **A row that is still plain text** must NOT be accepted. This proves lookups don't fall back to plain text. (Task 1 DB test.)
3. **Resend invite** deletes the right rows: it keeps the new hashed one and drops the others. (Existing resend test, updated.)
4. **A failed email** cleans up its token row: forgot-password and resend delete by hash. (Guard test plus review.)
5. **Any future code path** that writes or looks up a token without hashing it. (Guard test.)

### Task 1: hashToken plus every write and lookup
**Files:**
- `src/lib/tokens.ts`, plus a new `src/lib/tokens.test.ts` (in "test").
- The 7 files named in the spec.
- New `src/lib/security/login-tokens.db.test.ts` (in "test:db").
- Update the existing `sign-out-on-reset.db.test.ts`, `disabled-links.db.test.ts` and `resend-invite.db.test.ts` so their fixtures store `hashToken(raw)`.

**Produces:** `hashToken(raw: string): string` (64 lowercase hex).

- [ ] **Write the unit tests:**
  - `hashToken("abc")` equals the known SHA-256 of "abc" (`ba7816bf…15ad`);
  - **guard:** a scan of `src/app` and `src/lib` (non-test `.ts` files) finds every `(invitationToken|passwordResetToken).(create|findUnique|deleteMany|update)` call with a `token` key, and each one uses `hashToken(`.
- [ ] **Write the DB tests:**
  - `resendInvite` stores `hashToken(raw)`, where `raw` comes from `activateUrl`;
  - `inviteDealer` stores the hash of the returned token;
  - activate GET and POST accept a raw token whose hash is stored;
  - reset POST accepts a raw token whose hash is stored and rejects a row stored in plain text.
- [ ] **Watch them fail.** Then implement and update the fixtures. Run until both suites are green, then commit.

### Task 2: Migration for existing rows
- [ ] **Write a DB test:** insert a plain row, run the migration's SQL file against tri_test, and assert `row.token === hashToken(raw)` and that activate accepts `raw`. Watch it fail (no file yet).
- [ ] **Add** `prisma/migrations/20261120130000_hash_login_tokens/migration.sql` (the two UPDATEs). Run the test until green, then commit.

### Task 3: Live check and review
- [ ] **Run** `migrate deploy` on tri_stress, then build and start :3996.
- [ ] **Check the invite flow:** an Admin invites a staff user through `/api/users`. Read the link from the dev email log or the test hook, open it in a browser, and set a password.
- [ ] **Check the reset flow:** request a reset, follow the link, sign in with the new password.
- [ ] **Confirm** the DB rows hold 64-hex hashes that differ from the URL tokens.
- [ ] **Final review** by a fresh reviewer. Write the PR text to `D:\Downloads\pr-hash-login-tokens.md`.
