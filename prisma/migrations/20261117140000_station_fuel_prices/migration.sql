-- CreateTable
CREATE TABLE "StationFuelPrice" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "product" "ProductCode" NOT NULL,
    "basePriceKes" DOUBLE PRECISION,
    "dealerMarginKes" DOUBLE PRECISION,
    "transportMarginKes" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationFuelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StationFuelPrice_stationId_idx" ON "StationFuelPrice"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "StationFuelPrice_stationId_product_key" ON "StationFuelPrice"("stationId", "product");

-- AddForeignKey
ALTER TABLE "StationFuelPrice" ADD CONSTRAINT "StationFuelPrice_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;
