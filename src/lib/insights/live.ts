/**
 * Staff Analytics live strip: orders per open stage, orders stuck past their stage limit, and the
 * wording of recent order events. Pure functions over plain rows; client- and server-safe.
 */
import type { DealerOrderStatus } from "@prisma/client";
import { ORDER_STAGES, stageOf, statusLabel, type StageKey } from "@/lib/orders/stages";

export type InsightOrder = {
  id: string;
  reference: string;
  status: DealerOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  dealerName: string;
  stationName: string;
  stationCode: string | null;
  /** Quotation total incl. VAT as stored ("1066500.00"); null until quoted. */
  amountDue: string | null;
  lines: { product: string; quantityLitres: number }[];
};

export type InsightHistory = { orderId: string; toStatus: string; createdAt: Date };

const OPEN_STAGES: StageKey[] = ["quotation", "awaiting-payment", "checking-payment", "payment-confirmed", "depot", "transit"];

export function stageCounts(orders: InsightOrder[]): { key: StageKey; label: string; count: number; busiest: boolean }[] {
  const tiles = ORDER_STAGES.filter((s) => OPEN_STAGES.includes(s.key)).map((s) => ({
    key: s.key,
    label: s.label,
    count: orders.filter((o) => s.statuses.includes(o.status)).length,
    busiest: false,
  }));
  const max = Math.max(...tiles.map((t) => t.count));
  if (max > 0) tiles.find((t) => t.count === max)!.busiest = true;
  return tiles;
}

/** Hours an order may sit in a status before it counts as stuck (Adrian, 3 Nov). */
export const STUCK_LIMIT_HOURS: Partial<Record<DealerOrderStatus, number>> = {
  SUBMITTED: 2,
  ODOO_SYNC_PENDING: 2,
  QUOTATION_CREATING: 2,
  QUOTATION_READY: 4,
  PFI_PENDING: 4,
  PFI_ISSUED: 48,
  AWAITING_PAYMENT: 48,
  PAYMENT_SUBMITTED: 24,
  PAYMENT_VERIFICATION: 24,
  PAYMENT_CONFIRMED: 8,
  RELEASED_TO_DEPOT: 24,
  LOADING: 24,
  LOADED: 24,
  DISPATCHED: 48,
  IN_TRANSIT: 48,
};

const HOUR_MS = 3_600_000;

export function stuckOrders(orders: InsightOrder[], history: InsightHistory[], now: Date) {
  const entered = new Map<string, number>();
  for (const h of history) {
    const key = `${h.orderId}|${h.toStatus}`;
    entered.set(key, Math.max(entered.get(key) ?? 0, h.createdAt.getTime()));
  }
  return orders
    .flatMap((o) => {
      const limitHours = STUCK_LIMIT_HOURS[o.status];
      if (limitHours == null) return [];
      const since = entered.get(`${o.id}|${o.status}`) ?? o.updatedAt.getTime();
      const waitedMs = now.getTime() - since;
      if (waitedMs <= limitHours * HOUR_MS) return [];
      const stageLabel = ORDER_STAGES.find((s) => s.key === stageOf(o.status))?.label ?? statusLabel(o.status);
      return [{ id: o.id, reference: o.reference, dealerName: o.dealerName, stageLabel, waitedMs, limitHours }];
    })
    .sort((a, b) => b.waitedMs - b.limitHours * HOUR_MS - (a.waitedMs - a.limitHours * HOUR_MS));
}

export function eventText(e: {
  toStatus: string;
  reference: string;
  dealerName: string;
  stationName: string;
  depotName?: string | null;
}): string {
  switch (e.toStatus) {
    case "SUBMITTED":
      return `${e.dealerName} placed ${e.reference}`;
    case "PFI_ISSUED":
      return `PFI issued for ${e.reference}`;
    case "PAYMENT_SUBMITTED":
      return `${e.dealerName} submitted payment for ${e.reference}`;
    case "PAYMENT_CONFIRMED":
      return `Payment confirmed for ${e.reference}`;
    case "RELEASED_TO_DEPOT":
      return `${e.reference} released to ${e.depotName || "the depot"}`;
    case "DISPATCHED":
      return `${e.reference} left the depot`;
    case "DELIVERED":
      return `${e.reference} delivered to ${e.stationName}`;
    default:
      return `${e.reference}: ${statusLabel(e.toStatus)}`;
  }
}

/** 12,000,000 ms → "3 h 20 m"; days shown with hours, under an hour as minutes. */
export function formatWait(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return m ? `${h} h ${m} m` : `${h} h`;
  return `${m} m`;
}

export function timeAgo(at: Date, now: Date): string {
  const s = Math.floor((now.getTime() - at.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}
