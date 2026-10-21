-- Sessions signed in before a password change are ended (src/lib/auth.ts).
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
