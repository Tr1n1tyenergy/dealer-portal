-- A tank can feed many pumps. Existing pumps stay in place.
-- Only a pump whose key already matches a tank at the same station is linked.
-- No extra pumps are created for stations that were set up under the old one-to-one guess.

ALTER TABLE "StationPump" ADD COLUMN "tankId" TEXT;

CREATE INDEX "StationPump_tankId_idx" ON "StationPump"("tankId");

ALTER TABLE "StationPump" ADD CONSTRAINT "StationPump_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "StationTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "StationPump" AS p
SET "tankId" = t."id"
FROM "StationTank" AS t
WHERE p."tankId" IS NULL
  AND p."stationId" = t."stationId"
  AND p."product" = t."product"
  AND p."pumpKey" = t."tankKey";
