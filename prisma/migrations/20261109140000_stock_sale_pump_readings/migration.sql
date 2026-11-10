-- CreateTable
CREATE TABLE "StationPump" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "pumpKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastClosingLitres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationPump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSalePumpReading" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "pumpKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "openingLitres" DOUBLE PRECISION NOT NULL,
    "closingLitres" DOUBLE PRECISION,
    "rttLitres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesLitres" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSalePumpReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StationPump_stationId_active_sortOrder_idx" ON "StationPump"("stationId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StationPump_stationId_pumpKey_key" ON "StationPump"("stationId", "pumpKey");

-- CreateIndex
CREATE INDEX "StockSalePumpReading_reportId_sortOrder_idx" ON "StockSalePumpReading"("reportId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StockSalePumpReading_reportId_pumpKey_key" ON "StockSalePumpReading"("reportId", "pumpKey");

-- AddForeignKey
ALTER TABLE "StationPump" ADD CONSTRAINT "StationPump_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSalePumpReading" ADD CONSTRAINT "StockSalePumpReading_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StockSaleReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
