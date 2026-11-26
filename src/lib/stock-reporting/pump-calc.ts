import { sanitizeNumericText } from "@/lib/forms/numeric-text";

/** Decimal-safe litres math at 2dp (centilitres stored as integer). */

export function litresToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToLitres(cents: number): number {
  return cents / 100;
}

export function parseLitresInput(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Keep digits and one decimal point, and group thousands, without rounding. */
export function sanitizeNumericLitresDraft(raw: string): string {
  return sanitizeNumericText(raw, true);
}

/** Keep the typed litres exactly. Letters are already stripped; the digits are not rounded. */
export function commitLitresField(raw: string): string {
  const cleaned = sanitizeNumericLitresDraft(raw).trim();
  if (!cleaned || cleaned === ".") return "";
  return cleaned;
}

/** Editable litres: exact digits, with thousands separators and no forced decimals. */
export function formatLitresExact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const text = Object.is(value, -0) ? "0" : String(value);
  const plain = /[eE]/.test(text)
    ? value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 })
    : text;
  return sanitizeNumericText(plain, true);
}

export function formatLitresFixed(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLitresWithUnit(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatLitresFixed(value)} L`;
}

export type PumpSalesResult =
  | { ok: true; sales: number; gross: number }
  | { ok: false; error: string; sales: null; gross: number | null };

export function calculatePumpSales(params: {
  opening: number;
  closing: number | null;
  rtt: number;
}): PumpSalesResult {
  const { opening, closing, rtt } = params;
  if (closing == null) return { ok: false, error: "Closing meter is required.", sales: null, gross: null };
  if (closing < 0 || opening < 0 || rtt < 0) {
    return { ok: false, error: "Values must be nonnegative.", sales: null, gross: null };
  }
  if (closing < opening) {
    return {
      ok: false,
      error: "Closing meter cannot be below opening meter.",
      sales: null,
      gross: null,
    };
  }
  const grossCents = litresToCents(closing) - litresToCents(opening);
  const rttCents = litresToCents(rtt);
  if (rttCents > grossCents) {
    return {
      ok: false,
      error: "RTT cannot exceed meter movement.",
      sales: null,
      gross: centsToLitres(grossCents),
    };
  }
  const salesCents = grossCents - rttCents;
  return {
    ok: true,
    sales: centsToLitres(salesCents),
    gross: centsToLitres(grossCents),
  };
}

export function sumSalesByProduct(
  rows: { product: string; sales: number | null }[]
): { pms: number; ago: number; total: number } {
  let pms = 0;
  let ago = 0;
  for (const row of rows) {
    if (row.sales == null) continue;
    const c = litresToCents(row.sales);
    if (row.product === "PMS") pms += c;
    else if (row.product === "AGO") ago += c;
  }
  return {
    pms: centsToLitres(pms),
    ago: centsToLitres(ago),
    total: centsToLitres(pms + ago),
  };
}
