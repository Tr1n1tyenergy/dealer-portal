-- AlterTable
ALTER TABLE "StationPumpRttEvent" ADD COLUMN IF NOT EXISTS "jobCardStorageKey" TEXT;
ALTER TABLE "StationPumpRttEvent" ADD COLUMN IF NOT EXISTS "jobCardFileName" TEXT;
ALTER TABLE "StationPumpRttEvent" ADD COLUMN IF NOT EXISTS "jobCardMimeType" TEXT;
ALTER TABLE "StationPumpRttEvent" ADD COLUMN IF NOT EXISTS "jobCardSizeBytes" INTEGER;
