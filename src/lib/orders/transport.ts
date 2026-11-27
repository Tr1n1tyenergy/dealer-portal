import type { OdooDriverRecord } from "@/lib/integrations/odoo/types";
import { OrderInputError } from "@/lib/orders/order-input";

/** One Odoo truck.driver row, as the dealer is allowed to choose it. */
export type OrderDriverRecord = OdooDriverRecord;

export type TransportLine = {
  id: number;
  driverName: string;
  driverNo: string;
  driverEpra: string | null;
  truckPlate: string | null;
  truckEpra: string | null;
  capacityLitres: number;
  contactName: string | null;
};

const MAX_DRIVER_RECORDS = 20;

export function driverRecordLabel(record: Pick<TransportLine, "driverName" | "driverNo">) {
  const id = record.driverNo.trim();
  return id ? `${record.driverName} (${id})` : record.driverName;
}

function filled(value: string | null | undefined) {
  return Boolean(value?.trim());
}

/** How many of the driver-list columns actually have a value. */
export function driverRecordCompleteness(record: OrderDriverRecord) {
  return [
    record.contactName,
    record.driverNo,
    record.driverEpra,
    record.truckDetails,
    record.truckEpra,
    record.assignedTruckName,
  ].filter(filled).length;
}

/** Most complete records first. Same number of filled columns stays alphabetical. */
export function compareDriverRecords(a: OrderDriverRecord, b: OrderDriverRecord) {
  const byColumns = driverRecordCompleteness(b) - driverRecordCompleteness(a);
  if (byColumns !== 0) return byColumns;
  const byName = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.id - b.id;
}

export function sortDriverRecords<T extends OrderDriverRecord>(records: T[]): T[] {
  return [...records].sort(compareDriverRecords);
}

export function driverCountLabel(count: number) {
  return `${count} Driver Record${count === 1 ? "" : "s"}`;
}

export function transportDash(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

export function transportCapacity(litres: number) {
  return litres.toLocaleString("en-US");
}

/** Ids posted by the place-order form. The browser never sends the driver details themselves. */
export function parseDriverRecordIds(value: FormDataEntryValue | null): number[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value || "[]"));
  } catch {
    throw new OrderInputError("Add at least one driver record to continue.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new OrderInputError("Add at least one driver record to continue.");
  }
  if (parsed.length > MAX_DRIVER_RECORDS) {
    throw new OrderInputError(`An order can include at most ${MAX_DRIVER_RECORDS} driver records.`);
  }
  const ids: number[] = [];
  for (const item of parsed) {
    if (typeof item !== "number" || !Number.isInteger(item) || item <= 0) {
      throw new OrderInputError("Choose a driver record from the list.");
    }
    if (ids.includes(item)) {
      throw new OrderInputError("Each driver record can only be added once.");
    }
    ids.push(item);
  }
  return ids;
}

/**
 * Keep the dealer's order, and fill every transportation field from the server's copy
 * of the driver record. An id that is not in that copy is rejected.
 */
export function selectDriverSnapshots(catalog: OrderDriverRecord[], ids: number[]): OrderDriverRecord[] {
  if (ids.length === 0) throw new OrderInputError("Add at least one driver record to continue.");
  const seen = new Set<number>();
  const selected: OrderDriverRecord[] = [];
  for (const id of ids) {
    if (seen.has(id)) throw new OrderInputError("Each driver record can only be added once.");
    seen.add(id);
    const record = catalog.find((item) => item.id === id);
    if (!record) throw new OrderInputError("That driver record is not available. Choose another one.");
    selected.push(record);
  }
  return selected;
}

/**
 * Combined truck capacity is information only. Zero means the capacity was not recorded,
 * so it is not treated as a confirmed capacity and it never blocks the order.
 */
export function capacityNotice(lines: Pick<TransportLine, "capacityLitres">[], orderLitres: number): string | null {
  if (lines.length === 0 || orderLitres <= 0) return null;
  const unknown = lines.filter((line) => line.capacityLitres <= 0).length;
  const known = lines.reduce((sum, line) => sum + (line.capacityLitres > 0 ? line.capacityLitres : 0), 0);
  if (unknown === 0 && known < orderLitres) {
    return `The selected trucks list ${known.toLocaleString("en-US")} L of capacity for this ${orderLitres.toLocaleString("en-US")} L order. You can still place the order.`;
  }
  if (unknown > 0 && known < orderLitres) {
    const noun = unknown === 1 ? "record has" : "records have";
    return `${unknown} selected driver ${noun} no recorded capacity. Known capacity is ${known.toLocaleString("en-US")} L. This does not block the order.`;
  }
  return null;
}

export function toTransportLine(record: OrderDriverRecord): TransportLine {
  return {
    id: record.id,
    driverName: record.driverName,
    driverNo: record.driverNo,
    driverEpra: record.driverEpra,
    truckPlate: record.truckPlate,
    truckEpra: record.truckEpra,
    capacityLitres: record.capacityLitres,
    contactName: record.contactName,
  };
}

export function transportFromOrder(row: {
  odooDriverRecordId: number;
  driverName: string;
  driverNo: string;
  driverEpra: string | null;
  truckPlate: string | null;
  truckEpra: string | null;
  capacityLitres: number;
  contactName: string | null;
}): TransportLine {
  return {
    id: row.odooDriverRecordId,
    driverName: row.driverName,
    driverNo: row.driverNo,
    driverEpra: row.driverEpra,
    truckPlate: row.truckPlate,
    truckEpra: row.truckEpra,
    capacityLitres: row.capacityLitres,
    contactName: row.contactName,
  };
}
