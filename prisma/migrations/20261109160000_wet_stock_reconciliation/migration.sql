-- CreateEnum
CREATE TYPE "WetStockResolution" AS ENUM ('NONE', 'MATCH_DELIVERY', 'REVIEW_READINGS', 'RECORD_LOSS', 'BALANCED');

-- CreateEnum
CREATE TYPE "WetStockState" AS ENUM ('NOT_STARTED', 'VARIANCE_DETECTED', 'BALANCED', 'DELIVERY_MATCHING', 'READINGS_UNDER_REVIEW', 'VARIANCE_RECORDED', 'PENDING_APPROVAL', 'RECONCILED');

-- AlterTable
ALTER TABLE "StockSaleReport" ADD COLUMN "wetResolution" "WetStockResolution" NOT NULL DEFAULT 'NONE';
ALTER TABLE "StockSaleReport" ADD COLUMN "wetState" "WetStockState" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "StockSaleReport" ADD COLUMN "wetVariancePmsLitres" DOUBLE PRECISION;
ALTER TABLE "StockSaleReport" ADD COLUMN "wetVarianceAgoLitres" DOUBLE PRECISION;
ALTER TABLE "StockSaleReport" ADD COLUMN "wetVarianceTotalLitres" DOUBLE PRECISION;
ALTER TABLE "StockSaleReport" ADD COLUMN "wetAbsoluteVarianceLitres" DOUBLE PRECISION;
ALTER TABLE "StockSaleReport" ADD COLUMN "wetLossReason" TEXT;
ALTER TABLE "StockSaleReport" ADD COLUMN "wetLossAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "StockSaleReport" ADD COLUMN "wetLossAcknowledgedById" TEXT;

-- CreateTable
CREATE TABLE "StockSaleWetAudit" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSaleWetAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockSaleWetAudit_reportId_createdAt_idx" ON "StockSaleWetAudit"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "StockSaleWetAudit_actorId_idx" ON "StockSaleWetAudit"("actorId");

-- AddForeignKey
ALTER TABLE "StockSaleWetAudit" ADD CONSTRAINT "StockSaleWetAudit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StockSaleReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
