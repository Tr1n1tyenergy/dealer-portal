-- CreateEnum
CREATE TYPE "FleetTruckStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateTable
CREATE TABLE "FleetTruck" (
    "id" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "dealerOrganizationId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "capacityLitres" DOUBLE PRECISION NOT NULL,
    "status" "FleetTruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "truckType" TEXT,
    "driverName" TEXT,
    "driverContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetTruck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FleetTruck_truckNumber_key" ON "FleetTruck"("truckNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FleetTruck_registrationNumber_key" ON "FleetTruck"("registrationNumber");

-- CreateIndex
CREATE INDEX "FleetTruck_dealerOrganizationId_idx" ON "FleetTruck"("dealerOrganizationId");

-- CreateIndex
CREATE INDEX "FleetTruck_stationId_idx" ON "FleetTruck"("stationId");

-- CreateIndex
CREATE INDEX "FleetTruck_status_idx" ON "FleetTruck"("status");

-- CreateIndex
CREATE INDEX "FleetTruck_createdAt_idx" ON "FleetTruck"("createdAt");

-- AddForeignKey
ALTER TABLE "FleetTruck" ADD CONSTRAINT "FleetTruck_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTruck" ADD CONSTRAINT "FleetTruck_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
