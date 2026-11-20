-- Invite and password-reset tokens are stored as SHA-256 hex of the emailed token (src/lib/tokens.ts hashToken).
-- Hash the existing rows in place so links already emailed keep working. Run it BEFORE the code goes live.
-- DO NOT re-run by hand: hashing twice breaks every open invite and reset link.
UPDATE "InvitationToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
UPDATE "PasswordResetToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
