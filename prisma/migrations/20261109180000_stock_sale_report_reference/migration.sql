-- AlterTable
ALTER TABLE "StockSaleReport" ADD COLUMN "reportReference" TEXT;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedPumpCount" INTEGER;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedTankCount" INTEGER;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedPumpsPms" INTEGER;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedPumpsAgo" INTEGER;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedTanksPms" INTEGER;
ALTER TABLE "StockSaleReport" ADD COLUMN "submittedTanksAgo" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "StockSaleReport_reportReference_key" ON "StockSaleReport"("reportReference");
