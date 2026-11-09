import { litresToCents, centsToLitres, parseLitresInput, formatLitresFixed, formatLitresWithUnit } from "./pump-calc";

export { parseLitresInput, formatLitresFixed, formatLitresWithUnit, litresToCents, centsToLitres };

export type TankDipCalcResult =
  | { ok: true; sales: number; ullage: number; provisionalReceipt: boolean }
  | { ok: false; error: string; sales: null; ullage: number | null; provisionalReceipt: boolean };

/**
 * Ordinary no-receipt display: Tank Sales = Opening − Closing.
 * Ullage = Capacity − Closing.
 * Closing may exceed opening when receipts occurred — sales then go negative (provisional).
 */
export function calculateTankDip(params: {
  capacity: number;
  opening: number;
  closing: number | null;
}): TankDipCalcResult {
  const { capacity, opening, closing } = params;
  if (closing == null) {
    return { ok: false, error: "Closing stock is required.", sales: null, ullage: null, provisionalReceipt: false };
  }
  if (closing < 0 || opening < 0 || capacity <= 0) {
    return {
      ok: false,
      error: "Stock and capacity must be valid nonnegative values.",
      sales: null,
      ullage: null,
      provisionalReceipt: false,
    };
  }
  if (closing > capacity) {
    return {
      ok: false,
      error: "Closing stock cannot exceed tank capacity.",
      sales: null,
      ullage: null,
      provisionalReceipt: false,
    };
  }

  const salesCents = litresToCents(opening) - litresToCents(closing);
  const ullageCents = litresToCents(capacity) - litresToCents(closing);
  return {
    ok: true,
    sales: centsToLitres(salesCents),
    ullage: centsToLitres(ullageCents),
    provisionalReceipt: closing > opening,
  };
}

export function sumTankSalesByProduct(
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
