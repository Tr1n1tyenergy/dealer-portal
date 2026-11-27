-- Driver records chosen on a fuel order, frozen at the time the order is placed.
CREATE TABLE "DealerOrderTransport" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "odooDriverRecordId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverNo" TEXT NOT NULL,
    "driverEpra" TEXT,
    "truckPlate" TEXT,
    "truckEpra" TEXT,
    "capacityLitres" INTEGER NOT NULL,
    "odooContactId" INTEGER,
    "contactName" TEXT,
    "odooFleetTruckId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerOrderTransport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealerOrderTransport_orderId_odooDriverRecordId_key" ON "DealerOrderTransport"("orderId", "odooDriverRecordId");
CREATE INDEX "DealerOrderTransport_orderId_idx" ON "DealerOrderTransport"("orderId");

ALTER TABLE "DealerOrderTransport" ADD CONSTRAINT "DealerOrderTransport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DealerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
