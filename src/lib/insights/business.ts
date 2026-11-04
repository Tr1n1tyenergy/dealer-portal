import type { DealerOrderStatus } from "@prisma/client";
import { fulfillmentForStation, type LoadingWarehouseKey } from "@/lib/integrations/odoo/quotation-contract";
import { sumKes } from "@/lib/orders/money";
import { nairobiToday } from "@/lib/orders/order-input";
import { nairobiMonthStart } from "@/lib/time/nairobi";

export type Region = "Nairobi" | "Nakuru" | "Eldoret" | "Kisumu";
const REGIONS: Region[] = ["Nairobi", "Nakuru", "Eldoret", "Kisumu"];
const BY_WAREHOUSE: Record<LoadingWarehouseKey, Region> = {
  LAKE_OIL_NRB: "Nairobi",
  KPC_NAKURU: "Nakuru",
  KPC_ELDORET: "Eldoret",
  KPC_KISUMU: "Kisumu",
};
const NOT_COUNTED = ["CANCELLED", "REJECTED", "DRAFT"];
const DAY = 86400e3;

/** The loading region a station's fuel comes from (its warehouse), or null when the station isn't mapped. */
export function regionOf(stationCode: string | null): Region | null {
  const key = stationCode ? fulfillmentForStation(stationCode)?.warehouseKey : undefined;
  return key ? BY_WAREHOUSE[key] : null;
}

/** Litres per loading region, this Nairobi month and last; always the four regions in the same order. */
export function regionTotals(rows: { stationCode: string | null; litres: number; createdAt: Date }[], now: Date) {
  const start = nairobiMonthStart(now).getTime();
  const prev = nairobiMonthStart(now, -1).getTime();
  return REGIONS.map((region) => {
    const mine = rows.filter((r) => regionOf(r.stationCode) === region);
    const sum = (from: number, to: number) =>
      mine.filter((r) => r.createdAt.getTime() >= from && r.createdAt.getTime() < to).reduce((s, r) => s + r.litres, 0);
    return { region, thisMonth: sum(start, Infinity), lastMonth: sum(prev, start) };
  });
}

export function topDealers(rows: { dealer: string; litres: number }[], n = 5) {
  return [...rows].sort((a, b) => b.litres - a.litres).slice(0, n);
}

/** Dealers with no order for `days` days (or never), never-ordered first, then the longest silence. */
export function goneQuiet(dealers: { name: string; lastOrderAt: Date | null }[], now: Date, days = 30) {
  return dealers
    .map((d) => ({ name: d.name, days: d.lastOrderAt ? Math.floor((now.getTime() - d.lastOrderAt.getTime()) / DAY) : null }))
    .filter((d) => d.days === null || d.days > days)
    .sort((a, b) => (a.days === null ? -1 : b.days === null ? 1 : b.days - a.days));
}

type MonthRow = { createdAt: Date; status: string; amountDue: string | null; dealerId: string; lines: { quantityLitres: number }[] };

/** This month's litres, value (incl. VAT), orders and active dealers, with last month alongside; cancelled left out. */
export function monthFigures(rows: MonthRow[], now: Date) {
  const start = nairobiMonthStart(now).getTime();
  const prev = nairobiMonthStart(now, -1).getTime();
  const figures = (from: number, to: number) => {
    const m = rows.filter((r) => !NOT_COUNTED.includes(r.status) && r.createdAt.getTime() >= from && r.createdAt.getTime() < to);
    return {
      litres: m.reduce((s, r) => s + r.lines.reduce((t, l) => t + l.quantityLitres, 0), 0),
      value: sumKes(m.map((r) => r.amountDue)),
      orders: m.length,
      activeDealers: new Set(m.map((r) => r.dealerId)).size,
    };
  };
  return { ...figures(start, Infinity), prev: figures(prev, start) };
}

/** Today on the Nairobi calendar: orders placed (vs yesterday), litres ordered, payments confirmed, litres dispatched. */
export function todayFigures(
  input: {
    orders: { createdAt: Date; status: string; litres: number }[];
    confirmations: { at: Date; amount: string | null }[];
    dispatches: { at: Date; litres: number }[];
  },
  now: Date,
) {
  const today = nairobiToday(now);
  const yesterday = nairobiToday(new Date(now.getTime() - DAY));
  const day = (d: Date) => nairobiToday(d);
  const counted = input.orders.filter((o) => !NOT_COUNTED.includes(o.status));
  const placedToday = counted.filter((o) => day(o.createdAt) === today);
  const confirmed = input.confirmations.filter((c) => day(c.at) === today);
  return {
    newOrders: placedToday.length,
    newOrdersYesterday: counted.filter((o) => day(o.createdAt) === yesterday).length,
    litresOrdered: placedToday.reduce((s, o) => s + o.litres, 0),
    paymentsConfirmed: confirmed.length,
    paymentsValue: sumKes(confirmed.map((c) => c.amount)),
    litresDispatched: input.dispatches.filter((d) => day(d.at) === today).reduce((s, d) => s + d.litres, 0),
  };
}

const TO_PAY: DealerOrderStatus[] = ["PFI_ISSUED", "AWAITING_PAYMENT", "PAYMENT_EXCEPTION"];

/** What the dealer has to pay: PFIs waiting, their total to the cent, and how long the oldest has waited. */
export function toPay(orders: { status: DealerOrderStatus; amountDue: string | null; enteredAt: Date }[], now: Date) {
  const due = orders.filter((o) => TO_PAY.includes(o.status));
  return {
    total: sumKes(due.map((o) => o.amountDue)),
    count: due.length,
    oldestMs: due.length ? Math.max(...due.map((o) => now.getTime() - o.enteredAt.getTime())) : null,
  };
}

/** How far along the road an order is; anything not on its way is absent. */
const PROGRESS: Partial<Record<DealerOrderStatus, number>> = { RELEASED_TO_DEPOT: 1, LOADING: 2, LOADED: 3, DISPATCHED: 4, IN_TRANSIT: 4 };

/** The dealer's order to track: the one furthest along, the newest breaking ties; `more` = the others on their way. */
export function onTheWay(orders: { id: string; status: DealerOrderStatus; updatedAt: Date }[]) {
  const moving = orders
    .filter((o) => PROGRESS[o.status] !== undefined)
    .sort((a, b) => PROGRESS[b.status]! - PROGRESS[a.status]! || b.updatedAt.getTime() - a.updatedAt.getTime());
  return { current: moving[0]?.id ?? null, more: Math.max(0, moving.length - 1) };
}
