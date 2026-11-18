/**
 * Dealer fuel unit prices (KES/L, EXCLUDING VAT).
 *
 * Source of truth: Platform Settings → Stations & Pricing (`StationFuelPrice`).
 * Formula: (base − dealerMargin − transportMargin) / 1.08, truncated to 6 decimals
 * (base defaults to EPRA for the station’s loading region when not overridden).
 *
 * Stations without configured margins have no price: ordering and PFIs stay blocked.
 * The billed price per litre is this value × 1.08 (8% VAT).
 */

import { prisma } from "@/lib/prisma";
import { epraUnitPriceForStation } from "./epra-temp-prices";

export type DealerFuelProduct = "PMS" | "AGO";

export type StationDealerPrices = { pms: number | null; ago: number | null };

/** Truncate (chop) to 6 decimal places — no rounding. */
export function truncateTo6Decimals(n: number): number {
  if (!Number.isFinite(n)) return n;
  const sign = n < 0 ? -1 : 1;
  // Round away float noise at 9 dp first (213.3 / 1.08 = 197.49999999999997 must stay 197.5), then chop.
  return (sign * Math.floor(Math.round(Math.abs(n) * 1e9) / 1000)) / 1e6;
}

/** Ex-VAT dealer unit price from settings parts. */
export function dealerPriceFromParts(
  base: number | null,
  dealerMargin: number | null,
  transportMargin: number | null
): number | null {
  if (base == null || dealerMargin == null || transportMargin == null) return null;
  if (![base, dealerMargin, transportMargin].every((n) => Number.isFinite(n))) return null;
  return truncateTo6Decimals((base - dealerMargin - transportMargin) / 1.08);
}

function priceFromSavedRow(
  stationCode: string,
  product: DealerFuelProduct,
  saved:
    | {
        basePriceKes: number | null;
        dealerMarginKes: number | null;
        transportMarginKes: number | null;
      }
    | undefined
): number | null {
  if (!saved) return null;
  const epra = epraUnitPriceForStation(stationCode, product);
  const base = saved.basePriceKes != null ? saved.basePriceKes : epra;
  return dealerPriceFromParts(base, saved.dealerMarginKes, saved.transportMarginKes);
}

/** Lookup from a preloaded map (client forms / batch pages). */
export function dealerUnitPriceFromMap(
  map: ReadonlyMap<string, StationDealerPrices>,
  stationCode: string,
  product: DealerFuelProduct
): number | null {
  const row = map.get(stationCode);
  if (!row) return null;
  return product === "PMS" ? row.pms : row.ago;
}

/**
 * Load all configured station dealer prices (by portal station code).
 * Only stations with a code and at least one computed fuel price appear.
 */
export async function loadDealerUnitPriceMap(): Promise<Map<string, StationDealerPrices>> {
  const stations = await prisma.station.findMany({
    where: { code: { not: null } },
    select: {
      code: true,
      fuelPrices: {
        where: { product: { in: ["PMS", "AGO"] } },
        select: {
          product: true,
          basePriceKes: true,
          dealerMarginKes: true,
          transportMarginKes: true,
        },
      },
    },
  });

  const map = new Map<string, StationDealerPrices>();
  for (const st of stations) {
    if (!st.code) continue;
    const byProduct = new Map(st.fuelPrices.map((p) => [p.product, p]));
    map.set(st.code, {
      pms: priceFromSavedRow(st.code, "PMS", byProduct.get("PMS")),
      ago: priceFromSavedRow(st.code, "AGO", byProduct.get("AGO")),
    });
  }
  return map;
}

/** Async: settings-configured ex-VAT unit price for one station × product, or null. */
export async function dealerUnitPriceForStation(
  stationCode: string,
  product: DealerFuelProduct
): Promise<number | null> {
  const station = await prisma.station.findUnique({
    where: { code: stationCode },
    select: {
      code: true,
      fuelPrices: {
        where: { product },
        select: {
          basePriceKes: true,
          dealerMarginKes: true,
          transportMarginKes: true,
        },
        take: 1,
      },
    },
  });
  if (!station?.code) return null;
  return priceFromSavedRow(station.code, product, station.fuelPrices[0]);
}

/** Async: both fuels for one station. */
export async function dealerUnitPricesForStation(stationCode: string): Promise<StationDealerPrices> {
  const map = await loadDealerUnitPriceMap();
  return map.get(stationCode) ?? { pms: null, ago: null };
}
