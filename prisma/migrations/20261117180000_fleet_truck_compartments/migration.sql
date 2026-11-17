-- CreateTable
CREATE TABLE "TransportCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransportCompany_name_key" ON "TransportCompany"("name");
CREATE INDEX "TransportCompany_active_idx" ON "TransportCompany"("active");

ALTER TABLE "FleetTruck" ADD COLUMN IF NOT EXISTS "transportCompanyId" TEXT;
ALTER TABLE "FleetTruck" ADD COLUMN IF NOT EXISTS "driverId" TEXT;

ALTER TABLE "FleetTruck" ALTER COLUMN "dealerOrganizationId" DROP NOT NULL;
ALTER TABLE "FleetTruck" ALTER COLUMN "stationId" DROP NOT NULL;

ALTER TABLE "FleetTruck" DROP CONSTRAINT IF EXISTS "FleetTruck_dealerOrganizationId_fkey";
ALTER TABLE "FleetTruck" DROP CONSTRAINT IF EXISTS "FleetTruck_stationId_fkey";

ALTER TABLE "FleetTruck" ADD CONSTRAINT "FleetTruck_dealerOrganizationId_fkey" FOREIGN KEY ("dealerOrganizationId") REFERENCES "DealerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FleetTruck" ADD CONSTRAINT "FleetTruck_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FleetTruck_transportCompanyId_idx" ON "FleetTruck"("transportCompanyId");

ALTER TABLE "FleetTruck" ADD CONSTRAINT "FleetTruck_transportCompanyId_fkey" FOREIGN KEY ("transportCompanyId") REFERENCES "TransportCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FleetTruckCompartment" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "compartmentNumber" INTEGER NOT NULL,
    "capacityLitres" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetTruckCompartment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FleetTruckCompartment_truckId_idx" ON "FleetTruckCompartment"("truckId");
CREATE UNIQUE INDEX "FleetTruckCompartment_truckId_compartmentNumber_key" ON "FleetTruckCompartment"("truckId", "compartmentNumber");
ALTER TABLE "FleetTruckCompartment" ADD CONSTRAINT "FleetTruckCompartment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "FleetTruck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed transport companies from dealer organisation names (reusable logistics orgs)
INSERT INTO "TransportCompany" ("id", "name", "active", "createdAt", "updatedAt")
SELECT 'tc_' || substr(md5(d."id"), 1, 24), d."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "DealerOrganization" d
WHERE NOT EXISTS (SELECT 1 FROM "TransportCompany" tc WHERE tc."name" = d."name");

UPDATE "FleetTruck" t
SET "transportCompanyId" = tc."id"
FROM "DealerOrganization" d
JOIN "TransportCompany" tc ON tc."name" = d."name"
WHERE t."dealerOrganizationId" = d."id"
  AND t."transportCompanyId" IS NULL;

INSERT INTO "FleetTruckCompartment" ("id", "truckId", "compartmentNumber", "capacityLitres", "createdAt", "updatedAt")
SELECT 'fc_' || substr(md5(t."id" || '-1'), 1, 24), t."id", 1, t."capacityLitres", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "FleetTruck" t
WHERE NOT EXISTS (
  SELECT 1 FROM "FleetTruckCompartment" c WHERE c."truckId" = t."id"
);
