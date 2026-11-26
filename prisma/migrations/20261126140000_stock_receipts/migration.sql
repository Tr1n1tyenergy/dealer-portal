-- Stock receipts: a completed order split into the tanks that received it.

CREATE TYPE "StockReceiptBalanceEffect" AS ENUM ('ON_LAST_CLOSING', 'ON_REPORT');

CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "dealerOrganizationId" TEXT NOT NULL,
    "reportingDate" DATE NOT NULL,
    "balanceEffect" "StockReceiptBalanceEffect" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "tankKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReceipt_orderId_key" ON "StockReceipt"("orderId");
CREATE INDEX "StockReceipt_stationId_reportingDate_idx" ON "StockReceipt"("stationId", "reportingDate");
CREATE UNIQUE INDEX "StockReceiptLine_receiptId_tankId_key" ON "StockReceiptLine"("receiptId", "tankId");
CREATE INDEX "StockReceiptLine_tankId_idx" ON "StockReceiptLine"("tankId");

ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "StationTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
