-- AlterTable
ALTER TABLE "StationPump" ADD COLUMN "meterInitialized" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: pumps that already have a non-zero last closing are treated as initialized.
UPDATE "StationPump" SET "meterInitialized" = true WHERE "lastClosingLitres" > 0;

-- CreateEnum
CREATE TYPE "StationPumpRttStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateTable
CREATE TABLE "StationPumpRttEvent" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "pumpId" TEXT NOT NULL,
    "pumpKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "tankId" TEXT,
    "tankKey" TEXT,
    "tankLabel" TEXT,
    "volumeLitres" DOUBLE PRECISION NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "reportingDate" DATE NOT NULL,
    "notes" TEXT,
    "status" "StationPumpRttStatus" NOT NULL DEFAULT 'ACTIVE',
    "recordedById" TEXT NOT NULL,
    "submissionKey" TEXT,
    "originalVolumeLitres" DOUBLE PRECISION,
    "correctionReason" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationPumpRttEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StationPumpRttEvent_stationId_submissionKey_key" ON "StationPumpRttEvent"("stationId", "submissionKey");

-- CreateIndex
CREATE INDEX "StationPumpRttEvent_stationId_reportingDate_status_idx" ON "StationPumpRttEvent"("stationId", "reportingDate", "status");

-- CreateIndex
CREATE INDEX "StationPumpRttEvent_pumpId_reportingDate_status_idx" ON "StationPumpRttEvent"("pumpId", "reportingDate", "status");

-- CreateIndex
CREATE INDEX "StationPumpRttEvent_recordedById_idx" ON "StationPumpRttEvent"("recordedById");

-- AddForeignKey
ALTER TABLE "StationPumpRttEvent" ADD CONSTRAINT "StationPumpRttEvent_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationPumpRttEvent" ADD CONSTRAINT "StationPumpRttEvent_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "StationPump"("id") ON DELETE CASCADE ON UPDATE CASCADE;
