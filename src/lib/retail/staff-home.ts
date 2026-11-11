import type { DealerOrderStatus, PaymentState } from "@prisma/client";
import { NAIROBI_OFFSET_MS, nairobiMonthStart, nairobiParts } from "@/lib/time/nairobi";

/** Active / non-terminal order statuses for “Ongoing Orders”. */
export const ONGOING_ORDER_STATUSES: DealerOrderStatus[] = [
  "SUBMITTED",
  "ODOO_SYNC_PENDING",
  "QUOTATION_CREATING",
  "QUOTATION_READY",
  "PFI_PENDING",
  "PFI_ISSUED",
  "AWAITING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFICATION",
  "PAYMENT_CONFIRMED",
  "RELEASED_TO_DEPOT",
  "LOADING",
  "LOADED",
  "DISPATCHED",
  "IN_TRANSIT",
];

export const IN_TRANSIT_STATUSES: DealerOrderStatus[] = ["DISPATCHED", "IN_TRANSIT"];

export const WAITING_PAYMENT_STATUSES: DealerOrderStatus[] = ["PFI_ISSUED", "AWAITING_PAYMENT"];

export const PAYMENT_REVIEW_STATUSES: DealerOrderStatus[] = [
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFICATION",
];

/** Instant for 00:00 Africa/Nairobi on Y-M-D. */
export function nairobiDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - NAIROBI_OFFSET_MS);
}

/** Start of “today” in Nairobi as a UTC Date. */
export function nairobiTodayStart(at: Date = new Date()): Date {
  const { year, month, day } = nairobiParts(at);
  return nairobiDayStart(year, month, day);
}

/** Yesterday 00:00 Nairobi (reporting day dealers should have closed). */
export function nairobiYesterdayStart(at: Date = new Date()): Date {
  return new Date(nairobiTodayStart(at).getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Next EPRA price change: 15th of the month at 00:00 Africa/Nairobi.
 * Temporary tables roll on the 15th (see epra-temp-prices.ts).
 */
export function nextEpraEffectiveAt(at: Date = new Date()): Date {
  const { year, month, day } = nairobiParts(at);
  if (day < 15) return nairobiDayStart(year, month, 15);
  // After/on the 15th → next month’s 15th
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return nairobiDayStart(next.year, next.month, 15);
}

export function greetingForHour(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLitres(n: number): string {
  return `${Math.round(n).toLocaleString("en-KE")} L`;
}

export function formatWaitDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} h`;
  if (hours > 0) return `${hours} h`;
  const mins = Math.max(1, totalMin);
  return `${mins} min`;
}

export function relativeTimeLabel(at: Date, now: Date = new Date()): string {
  const delta = Math.max(0, now.getTime() - at.getTime());
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function thisMonthBounds(at: Date = new Date()) {
  const start = nairobiMonthStart(at);
  const end = nairobiMonthStart(at, 1);
  return { start, end };
}

export type ConfirmedPayment = { status: PaymentState; amount: string; paymentDate: Date | null; createdAt: Date };

/** Sum confirmed payments whose paymentDate (else createdAt) falls on Nairobi “today”. */
export function sumPaymentsToday(rows: ConfirmedPayment[], todayStart: Date, tomorrowStart: Date) {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    if (row.status !== "CONFIRMED") continue;
    const when = row.paymentDate ?? row.createdAt;
    if (when >= todayStart && when < tomorrowStart) {
      const n = Number(row.amount);
      if (Number.isFinite(n)) {
        total += n;
        count += 1;
      }
    }
  }
  return { total, count };
}
