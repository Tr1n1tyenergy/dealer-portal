/**
 * Input rules for dealer orders, payments and depot actions. Client-safe (no server imports), so the
 * server actions, the order service and the forms' browser limits all use the same numbers and messages.
 */

import { priceListEndDate } from "@/lib/integrations/odoo/price-list-status";
import { nairobiParts } from "@/lib/time/nairobi";

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** A refusal meant for the person who typed the input; server actions show its message. */
export class OrderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderInputError";
  }
}

export const MAX_LITRES = 100_000;
export const DELIVERY_WINDOW_DAYS = 90;
export const DEPOT_ACTIONS = ["accept", "complete", "dispatch", "deliver", "close"] as const;
export type DepotAction = (typeof DEPOT_ACTIONS)[number];

const QUANTITY_MESSAGE = "Quantity must be a whole number up to 100,000 L.";
const AMOUNT_MESSAGE = "Enter the amount paid, e.g. 1,070,150.00.";

const refuse = (message: string): { ok: false; message: string } => ({ ok: false, message });

export function parseLitres(value: unknown): Parsed<number> {
  const text = value == null ? "" : String(value).trim();
  if (text === "") return { ok: true, value: 0 };
  if (!/^\d+$/.test(text)) return refuse(QUANTITY_MESSAGE);
  const litres = Number(text);
  return litres <= MAX_LITRES ? { ok: true, value: litres } : refuse(QUANTITY_MESSAGE);
}

/** What a dealer typed in a litres box: digits only, empty as 0, capped at MAX_LITRES. */
export function typedLitres(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? 0 : Math.min(MAX_LITRES, Number(digits));
}

export function parseOrderLines(input: {
  pms: unknown;
  ago: unknown;
}): Parsed<{ product: "PMS" | "AGO"; quantityLitres: number }[]> {
  const lines: { product: "PMS" | "AGO"; quantityLitres: number }[] = [];
  for (const product of ["PMS", "AGO"] as const) {
    const parsed = parseLitres(product === "PMS" ? input.pms : input.ago);
    if (!parsed.ok) return parsed;
    if (parsed.value > 0) lines.push({ product, quantityLitres: parsed.value });
  }
  return lines.length ? { ok: true, value: lines } : refuse("Enter a quantity for PMS or AGO.");
}

/** Today's calendar date in Nairobi as YYYY-MM-DD. */
export function nairobiToday(now: Date = new Date()): string {
  const { year, month, day } = nairobiParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/**
 * Delivery dates a dealer may request: today (Nairobi) up to 90 days ahead, but never past the last
 * day of the current EPRA price list — later deliveries would be priced on a list we don't have yet.
 * Once the list has run out (before the new one is loaded), only today is allowed.
 */
export function deliveryWindow(
  now: Date = new Date(),
  priceListEnd: string = priceListEndDate(),
): { min: string; max: string } {
  const min = nairobiToday(now);
  const windowEnd = addDays(min, DELIVERY_WINDOW_DAYS);
  // ISO dates compare correctly as strings.
  const max = priceListEnd < windowEnd ? priceListEnd : windowEnd;
  return { min, max: max < min ? min : max };
}

/** A real calendar date written as YYYY-MM-DD. */
export function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseDeliveryDate(
  value: unknown,
  now: Date = new Date(),
  priceListEnd: string = priceListEndDate(),
): Parsed<string | null> {
  const text = value == null ? "" : String(value).trim();
  if (text === "") return { ok: true, value: null };
  const { min, max } = deliveryWindow(now, priceListEnd);
  // ISO dates compare correctly as strings.
  if (isRealDate(text) && text >= min && text <= max) return { ok: true, value: text };
  return refuse(`Choose a delivery date between ${displayDate(min)} and ${displayDate(max)}.`);
}

export function parsePaymentAmount(value: unknown): Parsed<string> {
  const text = value == null ? "" : String(value).trim();
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(text)) return refuse(AMOUNT_MESSAGE);
  const amount = Number(text.replace(/,/g, ""));
  return amount > 0 ? { ok: true, value: amount.toFixed(2) } : refuse(AMOUNT_MESSAGE);
}

export function isDepotAction(value: unknown): value is DepotAction {
  return (DEPOT_ACTIONS as readonly unknown[]).includes(value);
}
