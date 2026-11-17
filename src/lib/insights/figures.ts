/** Staff Analytics: this month's four figures, the 12-month litres series and median step times. */
import type { DealerOrderStatus } from "@prisma/client";
import { lastNMonthLabels, monthKey } from "@/lib/retail/analytics";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import type { InsightHistory, InsightOrder } from "./live";

/** Orders that never became real business are left out of every figure. */
const NOT_COUNTED: DealerOrderStatus[] = ["DRAFT", "CANCELLED", "REJECTED"];

export const counted = (o: InsightOrder) => !NOT_COUNTED.includes(o.status);

export type Pair = { now: number; prev: number; change: number | null };

const pair = (now: number, prev: number): Pair => ({
  now,
  prev,
  change: prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : null,
});

const litresOf = (o: InsightOrder) => o.lines.reduce((s, l) => s + l.quantityLitres, 0);
const valueOf = (o: InsightOrder) => {
  const v = Number(o.amountDue);
  return o.amountDue && Number.isFinite(v) ? v : 0;
};

export function monthFigures(orders: InsightOrder[], now: Date) {
  const start = nairobiMonthStart(now).getTime();
  const prevStart = nairobiMonthStart(now, -1).getTime();
  const live = orders.filter(counted);
  const thisMonth = live.filter((o) => o.createdAt.getTime() >= start && o.createdAt <= now);
  const lastMonth = live.filter((o) => o.createdAt.getTime() >= prevStart && o.createdAt.getTime() < start);
  const sum = (list: InsightOrder[], f: (o: InsightOrder) => number) => list.reduce((s, o) => s + f(o), 0);
  const dealers = (list: InsightOrder[]) => new Set(list.map((o) => o.dealerName)).size;
  return {
    litres: pair(sum(thisMonth, litresOf), sum(lastMonth, litresOf)),
    value: pair(sum(thisMonth, valueOf), sum(lastMonth, valueOf)),
    orders: pair(thisMonth.length, lastMonth.length),
    activeDealers: pair(dealers(thisMonth), dealers(lastMonth)),
  };
}

export function monthlyLitres(orders: InsightOrder[], now: Date, months = 12) {
  const byMonth = new Map<string, { pms: number; ago: number }>();
  for (const o of orders.filter(counted)) {
    const m = byMonth.get(monthKey(o.createdAt)) ?? { pms: 0, ago: 0 };
    for (const l of o.lines) {
      if (l.product === "PMS") m.pms += l.quantityLitres;
      if (l.product === "AGO") m.ago += l.quantityLitres;
    }
    byMonth.set(monthKey(o.createdAt), m);
  }
  return lastNMonthLabels(months, now).map(({ key, label }) => ({
    key,
    label: label.split(" ")[0],
    ...(byMonth.get(key) ?? { pms: 0, ago: 0 }),
  }));
}

const STEPS = [
  { label: "Order → PFI issued", from: "SUBMITTED", to: "PFI_ISSUED" },
  { label: "PFI → payment confirmed", from: "PFI_ISSUED", to: "PAYMENT_CONFIRMED" },
  { label: "Paid → released to depot", from: "PAYMENT_CONFIRMED", to: "RELEASED_TO_DEPOT" },
  { label: "Released → delivered", from: "RELEASED_TO_DEPOT", to: "DELIVERED" },
] as const;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median time per step, over steps whose end happened this Nairobi month. */
export function cycleTimes(history: InsightHistory[], now: Date) {
  const start = nairobiMonthStart(now).getTime();
  const byOrder = new Map<string, InsightHistory[]>();
  for (const h of history) byOrder.set(h.orderId, [...(byOrder.get(h.orderId) ?? []), h]);

  const steps = STEPS.map((step) => {
    const durations: number[] = [];
    for (const rows of byOrder.values()) {
      const end = rows
        .filter((r) => r.toStatus === step.to && r.createdAt.getTime() >= start && r.createdAt <= now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!end) continue;
      const begin = rows
        .filter((r) => r.toStatus === step.from && r.createdAt <= end.createdAt)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (begin) durations.push(end.createdAt.getTime() - begin.createdAt.getTime());
    }
    return { label: step.label, medianMs: median(durations), slowest: false };
  });
  const known = steps.filter((s) => s.medianMs != null);
  if (known.length) known.reduce((a, b) => (b.medianMs! > a.medianMs! ? b : a)).slowest = true;
  return steps;
}
