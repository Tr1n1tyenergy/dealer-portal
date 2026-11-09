import type { ProductCode } from "@prisma/client";

const FUEL_CODES: ProductCode[] = ["PMS", "AGO"];

/** Prefer PMS · AGO order for summary chips; fall back to other configured products. */
export function stationFuelProductLabels(productsJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(productsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const codes = parsed.filter((p): p is string => typeof p === "string");
  const fuel = FUEL_CODES.filter((c) => codes.includes(c));
  if (fuel.length) return fuel;
  return codes.slice(0, 4);
}

export function formatProductChip(labels: string[]): string {
  return labels.length ? labels.join(" · ") : "—";
}
