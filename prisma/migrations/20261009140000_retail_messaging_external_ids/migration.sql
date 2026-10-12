-- AlterTable
ALTER TABLE "DealerOrganization" ADD COLUMN IF NOT EXISTS "odooPartnerExternalId" TEXT;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "tradingName" TEXT;
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "odooPartnerExternalId" TEXT;
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "odooStationExternalId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DealerOrganization_odooPartnerExternalId_idx" ON "DealerOrganization"("odooPartnerExternalId");
CREATE INDEX IF NOT EXISTS "Station_odooPartnerExternalId_idx" ON "Station"("odooPartnerExternalId");
CREATE INDEX IF NOT EXISTS "Station_odooStationExternalId_idx" ON "Station"("odooStationExternalId");

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConversationKind" AS ENUM ('DIRECT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageReceiptStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
    "directKey" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MessageReceiptStatus" NOT NULL DEFAULT 'SENT',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_directKey_key" ON "Conversation"("directKey");
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReceipt_messageId_userId_key" ON "MessageReceipt"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "MessageReceipt_userId_idx" ON "MessageReceipt"("userId");

DO $$ BEGIN
  ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
