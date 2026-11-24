-- Invite and password-reset tokens are stored as SHA-256 hex of the emailed token (src/lib/tokens.ts hashToken).
-- Hash the rows stored in plain text so links already emailed keep working.
-- The hashing code (#86, 2f80f67) went live on production at 2026-11-23 09:34:49 UTC, before this migration ran:
-- rows created from then on are already hashed and must not be hashed again. createdAt is stored in UTC.
-- DO NOT re-run by hand: hashing twice breaks every open invite and reset link.
UPDATE "InvitationToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "createdAt" < '2026-11-23 09:34:49';
UPDATE "PasswordResetToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "createdAt" < '2026-11-23 09:34:49';
