/** Staff Analytics bottom row: litres by loading warehouse, top dealers, dealers gone quiet. */
import { fulfillmentForStation, type LoadingWarehouseKey } from "@/lib/integrations/odoo/quotation-contract";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import { counted } from "./figures";
import type { InsightOrder } from "./live";

const WAREHOUSE_LABEL: Record<LoadingWarehouseKey, string> = {
  LAKE_OIL_NRB: "Lake Oil Nairobi",
  KPC_NAKURU: "KPC Nakuru",
  KPC_ELDORET: "KPC Eldoret",
  KPC_KISUMU: "KPC Kisumu",
};

const litresOf = (o: InsightOrder) => o.lines.reduce((s, l) => s + l.quantityLitres, 0);

function warehouseOf(stationCode: string | null): string {
  const key = stationCode ? fulfillmentForStation(stationCode)?.warehouseKey : undefined;
  return key ? (WAREHOUSE_LABEL[key as LoadingWarehouseKey] ?? key) : "Other";
}

export function litresByWarehouse(orders: InsightOrder[], now: Date) {
  const start = nairobiMonthStart(now).getTime();
  const prevStart = nairobiMonthStart(now, -1).getTime();
  const rows = new Map<string, { name: string; litres: number; prevLitres: number }>();
  for (const o of orders.filter(counted)) {
    const t = o.createdAt.getTime();
    const field = t >= start && o.createdAt <= now ? "litres" : t >= prevStart && t < start ? "prevLitres" : null;
    if (!field) continue;
    const name = warehouseOf(o.stationCode);
    const row = rows.get(name) ?? { name, litres: 0, prevLitres: 0 };
    row[field] += litresOf(o);
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.litres - a.litres || b.prevLitres - a.prevLitres);
}

export function topDealers(orders: InsightOrder[], now: Date, n = 5) {
  const start = nairobiMonthStart(now).getTime();
  const byDealer = new Map<string, number>();
  for (const o of orders.filter(counted)) {
    if (o.createdAt.getTime() < start || o.createdAt > now) continue;
    byDealer.set(o.dealerName, (byDealer.get(o.dealerName) ?? 0) + litresOf(o));
  }
  return [...byDealer.entries()]
    .map(([name, litres]) => ({ name, litres }))
    .sort((a, b) => b.litres - a.litres)
    .slice(0, n);
}

const DAY_MS = 86_400_000;

export function goneQuiet(lastOrderByDealer: { name: string; lastOrderAt: Date }[], now: Date, days = 30, max = 8) {
  return lastOrderByDealer
    .map((d) => ({ name: d.name, days: Math.floor((now.getTime() - d.lastOrderAt.getTime()) / DAY_MS) }))
    .filter((d) => d.days > days)
    .sort((a, b) => b.days - a.days)
    .slice(0, max);
}
