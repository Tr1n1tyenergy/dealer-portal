import { Prisma } from "@prisma/client";

/**
 * One statement for every row, so a station with many pumps or tanks does not
 * spend a database round-trip per row inside a transaction.
 */
type Writer = Pick<Prisma.TransactionClient, "$executeRaw">;

function valueRows(rows: Array<{ key: string; numbers: Array<number | null> }>): Prisma.Sql {
  return Prisma.join(
    rows.map((row) => {
      const cells = [
        Prisma.sql`${row.key}::text`,
        ...row.numbers.map((value) => Prisma.sql`${value}::double precision`),
      ];
      return Prisma.sql`(${Prisma.join(cells)})`;
    })
  );
}

export async function writePumpMeterRows(
  tx: Writer,
  reportId: string,
  rows: Array<{
    pumpKey: string;
    openingLitres: number;
    closingLitres: number | null;
    rttLitres: number;
    salesLitres: number | null;
  }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = valueRows(
    rows.map((row) => ({
      key: row.pumpKey,
      numbers: [row.openingLitres, row.closingLitres, row.rttLitres, row.salesLitres],
    }))
  );
  return tx.$executeRaw`
    UPDATE "StockSalePumpReading" AS reading
    SET
      "openingLitres" = incoming.opening_litres,
      "closingLitres" = incoming.closing_litres,
      "rttLitres" = incoming.rtt_litres,
      "salesLitres" = incoming.sales_litres,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(
      pump_key,
      opening_litres,
      closing_litres,
      rtt_litres,
      sales_litres
    )
    WHERE reading."reportId" = ${reportId}
      AND reading."pumpKey" = incoming.pump_key
  `;
}

export async function writePumpClosingRows(
  tx: Writer,
  stationId: string,
  rows: Array<{ pumpKey: string; closingLitres: number }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = valueRows(
    rows.map((row) => ({
      key: row.pumpKey,
      numbers: [row.closingLitres],
    }))
  );
  return tx.$executeRaw`
    UPDATE "StationPump" AS pump
    SET
      "lastClosingLitres" = incoming.closing_litres,
      "meterInitialized" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(pump_key, closing_litres)
    WHERE pump."stationId" = ${stationId}
      AND pump."pumpKey" = incoming.pump_key
  `;
}

export async function writeTankDipRows(
  tx: Writer,
  reportId: string,
  rows: Array<{
    tankKey: string;
    openingLitres: number;
    closingLitres: number | null;
    salesLitres: number | null;
    ullageLitres: number | null;
  }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = valueRows(
    rows.map((row) => ({
      key: row.tankKey,
      numbers: [row.openingLitres, row.closingLitres, row.salesLitres, row.ullageLitres],
    }))
  );
  return tx.$executeRaw`
    UPDATE "StockSaleTankReading" AS reading
    SET
      "openingLitres" = incoming.opening_litres,
      "closingLitres" = incoming.closing_litres,
      "salesLitres" = incoming.sales_litres,
      "ullageLitres" = incoming.ullage_litres,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(
      tank_key,
      opening_litres,
      closing_litres,
      sales_litres,
      ullage_litres
    )
    WHERE reading."reportId" = ${reportId}
      AND reading."tankKey" = incoming.tank_key
  `;
}

export async function writeTankClosingRows(
  tx: Writer,
  stationId: string,
  rows: Array<{ tankKey: string; closingLitres: number }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = valueRows(
    rows.map((row) => ({
      key: row.tankKey,
      numbers: [row.closingLitres],
    }))
  );
  return tx.$executeRaw`
    UPDATE "StationTank" AS tank
    SET
      "lastClosingLitres" = incoming.closing_litres,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(tank_key, closing_litres)
    WHERE tank."stationId" = ${stationId}
      AND tank."tankKey" = incoming.tank_key
  `;
}

function sqlRows(rows: Prisma.Sql[][]): Prisma.Sql {
  return Prisma.join(rows.map((cells) => Prisma.sql`(${Prisma.join(cells)})`));
}

/** RTT litres, and sales when the pump already has a closing reading. */
export async function writePumpReadingPatches(
  tx: Writer,
  rows: Array<{ id: string; rttLitres: number; salesLitres: number | null; updateSales: boolean }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = sqlRows(
    rows.map((row) => [
      Prisma.sql`${row.id}::text`,
      Prisma.sql`${row.rttLitres}::double precision`,
      Prisma.sql`${row.salesLitres}::double precision`,
      Prisma.sql`${row.updateSales}::boolean`,
    ])
  );
  return tx.$executeRaw`
    UPDATE "StockSalePumpReading" AS reading
    SET
      "rttLitres" = incoming.rtt_litres,
      "salesLitres" = CASE
        WHEN incoming.update_sales THEN incoming.sales_litres
        ELSE reading."salesLitres"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(id, rtt_litres, sales_litres, update_sales)
    WHERE reading.id = incoming.id
  `;
}

/** Refresh label, order, capacity, and product on dip rows that are still open. */
export async function writeOpenTankDetails(
  tx: Writer,
  reportId: string,
  rows: Array<{
    tankKey: string;
    label: string;
    sortOrder: number;
    capacityLitres: number;
    product: "PMS" | "AGO";
  }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const values = sqlRows(
    rows.map((row) => [
      Prisma.sql`${row.tankKey}::text`,
      Prisma.sql`${row.label}::text`,
      Prisma.sql`${row.sortOrder}::integer`,
      Prisma.sql`${row.capacityLitres}::double precision`,
      Prisma.sql`${row.product}::"ProductCode"`,
    ])
  );
  return tx.$executeRaw`
    UPDATE "StockSaleTankReading" AS reading
    SET
      "label" = incoming.label,
      "sortOrder" = incoming.sort_order,
      "capacityLitres" = incoming.capacity_litres,
      "product" = incoming.product,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS incoming(
      tank_key,
      label,
      sort_order,
      capacity_litres,
      product
    )
    WHERE reading."reportId" = ${reportId}
      AND reading."tankKey" = incoming.tank_key
      AND reading."closingLitres" IS NULL
  `;
}
