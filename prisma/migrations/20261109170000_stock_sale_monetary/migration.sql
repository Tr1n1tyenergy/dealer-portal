-- CreateEnum
CREATE TYPE "MonetaryState" AS ENUM ('NOT_STARTED', 'INCOMPLETE', 'BALANCED', 'SHORTAGE', 'OVERAGE');

-- AlterTable
ALTER TABLE "StockSaleReport" ADD COLUMN "sellingPricePmsKes" DECIMAL(12,4);
ALTER TABLE "StockSaleReport" ADD COLUMN "sellingPriceAgoKes" DECIMAL(12,4);
ALTER TABLE "StockSaleReport" ADD COLUMN "expectedPmsKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "expectedAgoKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "cashCollectionsKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "mpesaCollectionsKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "cardCollectionsKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "monetaryDifferenceKes" DECIMAL(18,2);
ALTER TABLE "StockSaleReport" ADD COLUMN "monetaryState" "MonetaryState" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "StockSaleReport" ADD COLUMN "monetaryDiscrepancyReason" TEXT;

-- CreateTable
CREATE TABLE "StockSaleMonetaryAudit" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSaleMonetaryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockSaleMonetaryAudit_reportId_createdAt_idx" ON "StockSaleMonetaryAudit"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "StockSaleMonetaryAudit_actorId_idx" ON "StockSaleMonetaryAudit"("actorId");

-- AddForeignKey
ALTER TABLE "StockSaleMonetaryAudit" ADD CONSTRAINT "StockSaleMonetaryAudit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StockSaleReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
