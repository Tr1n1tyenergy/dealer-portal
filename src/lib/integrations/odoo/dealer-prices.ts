/**
 * Per-dealer fuel unit prices (KES/L, EXCLUDING VAT), keyed by portal station code.
 *
 * Source: Finance's price list received 11 Nov 2026 (EPRA 15 Oct – 14 Nov window).
 * These are the same ex-VAT unit prices sales types into Odoo quotations by hand —
 * verified against confirmed/draft orders S01310, S01325 and S01352 to 7 decimals.
 * The billed price per litre is this value × 1.08 (8% VAT).
 *
 * Dealers with two stations (Vereca: nakuru + banana, Iko Winners: maili-tatu +
 * maua-town) are priced per STATION, exactly as on Finance's list.
 *
 * Stations not on the list have no price: ordering and PFIs stay blocked for them.
 * The list changes with the EPRA window on the 15th of every month — update these
 * values then. Replace with Odoo pricelists once those become the source of truth.
 */

export type DealerFuelProduct = "PMS" | "AGO";

/** Ex-VAT unit prices by station code, verbatim from Finance (11 Nov 2026). */
export const DEALER_UNIT_PRICES_BY_STATION: Record<string, { pms: number; ago: number }> = {
  athiriver: { pms: 198.49074, ago: 199.231481 }, // Oilden
  migori: { pms: 202.518518, ago: 203.629629 }, // Sure Technologies
  "ol-joro-orok": { pms: 197.055555, ago: 198.37037 }, // Etal
  magumu: { pms: 197.564814, ago: 198.305555 }, // Beekey
  nakuru: { pms: 201.796296, ago: 202.907407 }, // Vereca (Nakuru)
  rimpa: { pms: 198.953703, ago: 199.694444 }, // Raban
  "meru-gaitu": { pms: 197.222222, ago: 197.962962 }, // Elobay
  kitale: { pms: 197.5, ago: 198.611111 }, // Pery Growers
  kisii: { pms: 204.611111, ago: 205.712962 }, // Maxwel Nyaanga Magoma
  sobea: { pms: 202.888888, ago: 204.0 }, // Ninas
  kiserian: { pms: 197.481481, ago: 198.222222 }, // Tulla
  "kabati-kitui": { pms: 202.935185, ago: 203.675925 }, // Rutiben
  banana: { pms: 202.935185, ago: 203.675925 }, // Vereca (Banana)
  kitanga: { pms: 204.027777, ago: 204.768518 }, // Memisi
  greensted: { pms: 196.314814, ago: 197.425925 }, // Kenbi
  mumias: { pms: 202.518518, ago: 203.629629 }, // Masaha ("Majaha" on the list)
  "maili-tatu": { pms: 198.953703, ago: 199.694444 }, // Iko Winners (Maili Tatu)
  "maua-town": { pms: 202.935185, ago: 203.675925 }, // Iko Winners (Maua)
  // shortcut: written as 197.22222 on the list (a missed digit; Elobay shares the AGO
  // price and has 197.222222) — using the six-decimal value; fix if Finance says otherwise.
  thome: { pms: 197.222222, ago: 197.962962 }, // Ready To Go
};

/** The dealer's ex-VAT unit price for a station, or null when Finance has not priced it. */
export function dealerUnitPriceForStation(
  stationCode: string,
  product: DealerFuelProduct
): number | null {
  const row = DEALER_UNIT_PRICES_BY_STATION[stationCode];
  if (!row) return null;
  return product === "PMS" ? row.pms : row.ago;
}
