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
  return centsToLitres(litresToCents(n));
}

/** Keep only digits and at most one decimal point while typing. */
export function sanitizeNumericLitresDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

/**
 * Round to `sigFigs` significant figures (e.g. 1254.7 → 1255 at 4 s.f.).
 * Zero stays zero. Used for meter field commit/blur.
 */
export function roundToSignificantFigures(value: number, sigFigs = 4): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const order = Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** (sigFigs - 1 - order);
  return Math.round(value * scale) / scale;
}

/** Format a draft field after blur: numeric only, 4 significant figures. */
export function commitLitresField(raw: string, sigFigs = 4): string {
  const cleaned = sanitizeNumericLitresDraft(raw).trim();
  if (!cleaned || cleaned === ".") return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  const rounded = roundToSignificantFigures(n, sigFigs);
  // Prefer plain numeric string (no thousands separators) for editable fields.
  const asFixed = rounded.toPrecision(sigFigs);
  const asNumber = Number(asFixed);
  if (!Number.isFinite(asNumber)) return "";
  return String(asNumber);
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
