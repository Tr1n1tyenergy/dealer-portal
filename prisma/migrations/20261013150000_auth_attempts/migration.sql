-- CreateEnum
CREATE TYPE "AuthAttemptKind" AS ENUM ('LOGIN_FAILURE', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "kind" "AuthAttemptKind" NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_email_createdAt_idx" ON "AuthAttempt"("kind", "email", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_kind_ip_createdAt_idx" ON "AuthAttempt"("kind", "ip", "createdAt");

