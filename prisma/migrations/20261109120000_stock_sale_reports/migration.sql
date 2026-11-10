-- CreateEnum
CREATE TYPE "StockSaleReportStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateEnum
CREATE TYPE "StockSaleReportStage" AS ENUM ('PUMP_METERS', 'TANK_DIPS', 'WET_STOCK', 'MONETARY');

-- AlterTable
ALTER TABLE "Station" ADD COLUMN "pumpCount" INTEGER;
ALTER TABLE "Station" ADD COLUMN "tankCount" INTEGER;

-- CreateTable
CREATE TABLE "StockSaleReport" (
    "id" TEXT NOT NULL,
    "dealerOrganizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "reportingDate" DATE NOT NULL,
    "status" "StockSaleReportStatus" NOT NULL DEFAULT 'DRAFT',
    "pumpMetersCompletedAt" TIMESTAMP(3),
    "tankDipsCompletedAt" TIMESTAMP(3),
    "wetStockCompletedAt" TIMESTAMP(3),
    "monetaryCompletedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "meterSalesPmsLitres" DOUBLE PRECISION,
    "meterSalesAgoLitres" DOUBLE PRECISION,
    "tankSalesPmsLitres" DOUBLE PRECISION,
    "tankSalesAgoLitres" DOUBLE PRECISION,
    "totalSalesLitres" DOUBLE PRECISION,
    "expectedRevenueKes" DECIMAL(18,2),
    "collectionsKes" DECIMAL(18,2),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSaleReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockSaleReport_dealerOrganizationId_reportingDate_idx" ON "StockSaleReport"("dealerOrganizationId", "reportingDate");

-- CreateIndex
CREATE INDEX "StockSaleReport_stationId_status_idx" ON "StockSaleReport"("stationId", "status");

-- CreateIndex
CREATE INDEX "StockSaleReport_createdById_idx" ON "StockSaleReport"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StockSaleReport_stationId_reportingDate_key" ON "StockSaleReport"("stationId", "reportingDate");

-- AddForeignKey
ALTER TABLE "StockSaleReport" ADD CONSTRAINT "StockSaleReport_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSaleReport" ADD CONSTRAINT "StockSaleReport_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;
