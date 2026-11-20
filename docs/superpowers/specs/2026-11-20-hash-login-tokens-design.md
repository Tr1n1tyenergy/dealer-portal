# Hash invite and password-reset tokens (to-do 2.3)

**Status:** approved by Adrian, 20 Nov 2026 · **Size:** small change

## Why
`InvitationToken.token` and `PasswordResetToken.token` hold the exact secret that is emailed in activation and reset links. Anyone who reads the database (a leaked backup, a read-only credential, a SQL mistake) could activate an invited account or reset a password. This was stress-test finding 5.

## Design
- **New helper:** `hashToken(raw)` in `src/lib/tokens.ts` returns SHA-256 hex of the UTF-8 string. Tokens are 32 random bytes, so a plain fast hash is enough; no salt or slow hash is needed.
- **Writes:** every `create` stores `hashToken(raw)`. The raw value is used only in the emailed URL.
- **Lookups and deletes** by token use `hashToken(input)`.
- **Places that change:**
  - `api/auth/forgot-password`, `api/auth/reset-password`, `api/auth/activate` (GET and POST);
  - `api/retail/invite/staff`, `api/users`;
  - `lib/dealers/dealer-invite.ts`, `lib/users/resend-invite.ts`.
- **Data migration** `20261120130000_hash_login_tokens` turns existing rows into hashes in place:
  `UPDATE … SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex')`.
  Links already sent keep working, and no plain-text fallback is needed.
- **A guard test** scans the source so that any new `invitationToken` / `passwordResetToken` create or token lookup must go through `hashToken`.

## Deploy note
Run the migration right before deploying. For the few minutes in between, links are checked against the old code's plain lookup and will fail; the person just tries again after the deploy. Any link created in that gap is stored in plain text and won't work after the deploy, so resend it.

## Not doing
- No change to how long links last.
- No change to the URL format.
- No new columns.
