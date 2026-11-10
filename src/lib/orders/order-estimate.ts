import { pfiTotals, type PfiLineInput, type PfiTotals } from "./pfi-totals";

/**
 * What Place an order shows while the dealer types: the same sums as the PFI (EPRA price + 8% VAT).
 * Null when the station has no price or nothing is ordered.
 */
export function orderEstimate(
  litres: { pms: number; ago: number },
  prices: { pms: number; ago: number } | null,
): PfiTotals | null {
  if (!prices) return null;
  const lines: PfiLineInput[] = (["PMS", "AGO"] as const)
    .map((product) => {
      const key = product === "PMS" ? "pms" : "ago";
      return { product, quantityLitres: litres[key], unitPriceExVat: prices[key].toFixed(2) };
    })
    .filter((line) => line.quantityLitres > 0);
  return lines.length ? pfiTotals(lines) : null;
}
