import type { DealerOrderStatus } from "@prisma/client";
import { statusLabel, type StageKey } from "@/lib/orders/stages";

/** The 8 "Orders by stage" tiles (live dashboards spec §3.1); each opens that Orders tab. */
export const STAGE_TILES: { key: string; label: string; statuses: DealerOrderStatus[]; tab: StageKey }[] = [
  { key: "submitted", label: "Submitted", statuses: ["SUBMITTED", "ODOO_SYNC_PENDING"], tab: "pending" },
  { key: "quotation", label: "Quotation", statuses: ["QUOTATION_CREATING", "QUOTATION_READY", "ODOO_SYNC_FAILED"], tab: "pending" },
  { key: "pfi", label: "PFI ready", statuses: ["PFI_PENDING", "PFI_ISSUED"], tab: "pending" },
  { key: "awaiting-payment", label: "Awaiting payment", statuses: ["AWAITING_PAYMENT"], tab: "awaiting-payment" },
  { key: "checking", label: "Checking payment", statuses: ["PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION"], tab: "verification" },
  { key: "paid", label: "Paid", statuses: ["PAYMENT_CONFIRMED"], tab: "paid" },
  { key: "at-depot", label: "At depot", statuses: ["RELEASED_TO_DEPOT", "LOADING", "LOADED"], tab: "depot" },
  { key: "on-the-road", label: "On the road", statuses: ["DISPATCHED", "IN_TRANSIT"], tab: "depot" },
];

export function stageCounts(rows: { status: DealerOrderStatus }[]) {
  return STAGE_TILES.map(({ key, label, statuses, tab }) => ({ key, label, tab, count: rows.filter((r) => statuses.includes(r.status)).length }));
}

const HOUR = 3600e3;

/** How long an order may wait in a stage before it counts as stuck (Adrian, 3 Nov). */
export const STUCK_LIMIT_HOURS: Partial<Record<DealerOrderStatus, number>> = {
  SUBMITTED: 2, ODOO_SYNC_PENDING: 2, QUOTATION_CREATING: 2, QUOTATION_READY: 2, ODOO_SYNC_FAILED: 2,
  PFI_PENDING: 4, PFI_ISSUED: 4,
  AWAITING_PAYMENT: 48,
  PAYMENT_SUBMITTED: 24, PAYMENT_VERIFICATION: 24,
  PAYMENT_CONFIRMED: 8,
  RELEASED_TO_DEPOT: 24, LOADING: 24, LOADED: 24,
  DISPATCHED: 48, IN_TRANSIT: 48,
};

/** How long an order has sat in its status, and whether that is past the stage's stuck limit. */
export function waitedOn(r: { status: DealerOrderStatus; enteredAt: Date | null; updatedAt: Date }, now: Date) {
  const waitedMs = now.getTime() - (r.enteredAt ?? r.updatedAt).getTime();
  const limit = STUCK_LIMIT_HOURS[r.status];
  return { waitedMs, over: limit !== undefined && waitedMs > limit * HOUR };
}

/** Open orders over their stage's limit, most over first. `enteredAt` = latest history row into the status. */
export function stuckOrders(
  rows: { id: string; reference: string; status: DealerOrderStatus; dealer: string; enteredAt: Date | null; updatedAt: Date }[],
  now: Date,
) {
  return rows
    .flatMap((r) => {
      const limit = STUCK_LIMIT_HOURS[r.status];
      if (limit === undefined) return [];
      const waitedMs = now.getTime() - (r.enteredAt ?? r.updatedAt).getTime();
      const overBy = waitedMs - limit * HOUR;
      return overBy > 0 ? [{ id: r.id, reference: r.reference, dealer: r.dealer, status: r.status, waitedMs, overBy }] : [];
    })
    .sort((a, b) => b.overBy - a.overBy);
}

/** "40 min", "26 h", "3 d 4 h". */
export function formatWaited(ms: number): string {
  const mins = Math.floor(ms / 60e3);
  if (mins < 60) return `${Math.max(0, mins)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** One line of the "Happening now" feed for an order's status change. */
export function eventLine(e: { toStatus: string; reference: string; dealer: string; depot?: string | null }): string {
  const depot = e.depot || "The depot";
  switch (e.toStatus) {
    case "SUBMITTED":
      return `${e.dealer} placed ${e.reference}`;
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return `PFI issued for ${e.reference} · ${e.dealer}`;
    case "PAYMENT_SUBMITTED":
      return `${e.dealer} submitted payment for ${e.reference}`;
    case "PAYMENT_CONFIRMED":
      return `Payment confirmed for ${e.reference}`;
    case "PAYMENT_EXCEPTION":
      return `Payment flagged for ${e.reference}`;
    case "RELEASED_TO_DEPOT":
      return `${e.reference} released to ${e.depot || "the depot"}`;
    case "LOADING":
      return `${depot} started loading ${e.reference}`;
    case "DISPATCHED":
      return `${e.reference} left ${e.depot || "the depot"}`;
    case "DELIVERED":
      return `${e.reference} delivered to ${e.dealer}`;
    default:
      return `${e.reference}: ${statusLabel(e.toStatus)}`;
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const STEPS = [
  ["Order → PFI", "createdAt", "quotedAt"],
  ["PFI → paid", "quotedAt", "paidAt"],
  ["Paid → released", "paidAt", "releasedAt"],
  ["Released → delivered", "releasedAt", "deliveredAt"],
] as const;

type CycleRow = { createdAt: Date; quotedAt: Date | null; paidAt: Date | null; releasedAt: Date | null; deliveredAt: Date | null };

/** Median time for each step, over the orders that have both ends; null when none do. */
export function cycleMedians(rows: CycleRow[]) {
  return STEPS.map(([step, from, to]) => ({
    step,
    medianMs: median(rows.flatMap((r) => (r[from] && r[to] ? [r[to]!.getTime() - r[from]!.getTime()] : [])).filter((ms) => ms >= 0)),
  }));
}
