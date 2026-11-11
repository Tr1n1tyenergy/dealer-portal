/** Pure helpers for the staff Orders workspace: filters, reporting periods,
 * payment summary and tracker timestamps. No Prisma client here. */
import type { DealerOrderStatus, PaymentState } from "@prisma/client";
import { NAIROBI_OFFSET_MS, nairobiMonthStart, nairobiParts } from "@/lib/time/nairobi";
import { dealerTrackerSteps, DEALER_TRACKER_STEPS } from "@/lib/orders/state-machine";
import { parseStage, type StageKey } from "@/lib/orders/stages";

export type PeriodKey = "all" | "today" | "yesterday" | "7d" | "month" | "prev-month" | "custom";

export type StaffOrderFilters = {
  stage: StageKey | "all";
  q: string;
  page: number;
  stationId: string | null;
  dealerId: string | null;
  period: PeriodKey;
  from: string | null;
  to: string | null;
  /** createdAt range the period resolves to, or null for all time */
  range: { gte: Date; lt: Date } | null;
  sel: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const id = (value: string) => (/^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : null);

/** 00:00 Nairobi on a calendar day, as an instant. */
function nairobiDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - NAIROBI_OFFSET_MS);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The createdAt range a reporting-period choice means, in Nairobi time; null = no date filter. */
export function reportingPeriod(
  period: string,
  from: string | null,
  to: string | null,
  now: Date
): { gte: Date; lt: Date } | null {
  const { year, month, day } = nairobiParts(now);
  const todayStart = nairobiDayStart(year, month, day);
  switch (period) {
    case "today":
      return { gte: todayStart, lt: new Date(todayStart.getTime() + DAY_MS) };
    case "yesterday":
      return { gte: new Date(todayStart.getTime() - DAY_MS), lt: todayStart };
    case "7d":
      return { gte: new Date(todayStart.getTime() - 6 * DAY_MS), lt: new Date(todayStart.getTime() + DAY_MS) };
    case "month":
      return { gte: nairobiMonthStart(now), lt: nairobiMonthStart(now, 1) };
    case "prev-month":
      return { gte: nairobiMonthStart(now, -1), lt: nairobiMonthStart(now) };
    case "custom": {
      const a = ISO_DAY.exec(from ?? "");
      const b = ISO_DAY.exec(to ?? "");
      if (!a || !b) return null;
      const gte = nairobiDayStart(Number(a[1]), Number(a[2]), Number(a[3]));
      const lt = new Date(nairobiDayStart(Number(b[1]), Number(b[2]), Number(b[3])).getTime() + DAY_MS);
      return gte.getTime() < lt.getTime() ? { gte, lt } : null;
    }
    default:
      return null;
  }
}

/** Everything the Orders workspace reads from the URL, validated. */
export function staffOrderFilters(params: Params, now: Date = new Date()): StaffOrderFilters {
  const stage = parseStage(first(params.stage));
  const q = first(params.q).trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const stationId = id(first(params.station));
  const dealerId = id(first(params.dealer));
  const from = ISO_DAY.test(first(params.from)) ? first(params.from) : null;
  const to = ISO_DAY.test(first(params.to)) ? first(params.to) : null;
  const rawPeriod = first(params.period);
  const period: PeriodKey = ["today", "yesterday", "7d", "month", "prev-month", "custom"].includes(rawPeriod)
    ? (rawPeriod as PeriodKey)
    : "all";
  return {
    stage,
    q,
    page,
    stationId,
    dealerId,
    period,
    from,
    to,
    range: reportingPeriod(period, from, to, now),
    sel: id(first(params.sel)),
  };
}

/** Paid = confirmed payment records; due = PFI total minus paid, floored at zero. Cents-exact. */
export function paymentSummary(
  pfiAmount: string | null | undefined,
  payments: { amount: string; status: PaymentState }[]
): { paid: string; due: string | null } {
  const cents = (text: string | null | undefined) => {
    const clean = (text ?? "").replace(/,/g, "").trim();
    return /^\d+(\.\d+)?$/.test(clean) ? Math.round(Number(clean) * 100) : null;
  };
  const paid = payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum + (cents(p.amount) ?? 0), 0);
  const total = cents(pfiAmount);
  const asText = (c: number) => (c / 100).toFixed(2);
  return { paid: asText(paid), due: total == null ? null : asText(Math.max(0, total - paid)) };
}

/** Where a status sits on the 7-step tracker: 0–6 the step it waits on, 7 all done, null stopped. */
function stepIndex(status: DealerOrderStatus): number | null {
  const position = dealerTrackerSteps(status) as ReturnType<typeof dealerTrackerSteps> | undefined;
  if (!position) return null; // history rows are text; an unknown status must not crash the page
  const { steps, stopped } = position;
  if (stopped) return null;
  const active = steps.findIndex((s) => s.state === "active" || s.state === "attention");
  return active === -1 ? steps.length : active;
}

/** For each of the 7 tracker steps, when the order first moved past it (null = not yet). */
export function stepCompletionTimes(
  history: { toStatus: string; createdAt: Date }[]
): (Date | null)[] {
  const times: (Date | null)[] = DEALER_TRACKER_STEPS.map(() => null);
  const rows = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const row of rows) {
    const idx = stepIndex(row.toStatus as DealerOrderStatus);
    if (idx == null) continue;
    for (let step = 0; step < idx && step < times.length; step++) {
      if (!times[step]) times[step] = row.createdAt;
    }
  }
  return times;
}
