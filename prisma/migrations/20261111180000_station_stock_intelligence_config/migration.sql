-- CreateTable
CREATE TABLE "StationStockIntelligenceConfig" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "pmsDailyTargetLitres" DOUBLE PRECISION,
    "agoDailyTargetLitres" DOUBLE PRECISION,
    "pmsWeeklyTargetLitres" DOUBLE PRECISION,
    "agoWeeklyTargetLitres" DOUBLE PRECISION,
    "pmsMonthlyTargetLitres" DOUBLE PRECISION,
    "agoMonthlyTargetLitres" DOUBLE PRECISION,
    "pmsYearlyTargetLitres" DOUBLE PRECISION,
    "agoYearlyTargetLitres" DOUBLE PRECISION,
    "pmsMinHoldingLitres" DOUBLE PRECISION,
    "agoMinHoldingLitres" DOUBLE PRECISION,
    "pmsTwoDayHoldingLitres" DOUBLE PRECISION,
    "agoTwoDayHoldingLitres" DOUBLE PRECISION,
    "pmsWarningCoverDays" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "agoWarningCoverDays" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "pmsCriticalCoverDays" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "agoCriticalCoverDays" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationStockIntelligenceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StationStockIntelligenceConfig_stationId_effectiveFrom_idx" ON "StationStockIntelligenceConfig"("stationId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "StationStockIntelligenceConfig_createdById_idx" ON "StationStockIntelligenceConfig"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StationStockIntelligenceConfig_stationId_effectiveFrom_key" ON "StationStockIntelligenceConfig"("stationId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "StationStockIntelligenceConfig" ADD CONSTRAINT "StationStockIntelligenceConfig_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;
