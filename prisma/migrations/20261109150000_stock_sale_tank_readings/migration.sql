-- CreateTable
CREATE TABLE "StationTank" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "tankKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capacityLitres" DOUBLE PRECISION NOT NULL,
    "lastClosingLitres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSaleTankReading" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "tankKey" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capacityLitres" DOUBLE PRECISION NOT NULL,
    "openingLitres" DOUBLE PRECISION NOT NULL,
    "closingLitres" DOUBLE PRECISION,
    "salesLitres" DOUBLE PRECISION,
    "ullageLitres" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSaleTankReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StationTank_stationId_active_sortOrder_idx" ON "StationTank"("stationId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StationTank_stationId_tankKey_key" ON "StationTank"("stationId", "tankKey");

-- CreateIndex
CREATE INDEX "StockSaleTankReading_reportId_sortOrder_idx" ON "StockSaleTankReading"("reportId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StockSaleTankReading_reportId_tankKey_key" ON "StockSaleTankReading"("reportId", "tankKey");

-- AddForeignKey
ALTER TABLE "StationTank" ADD CONSTRAINT "StationTank_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSaleTankReading" ADD CONSTRAINT "StockSaleTankReading_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StockSaleReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
