import catalog from "./fuel-products.json";

/** The fuels the dealer portal orders (PMS and AGO only). */
export type FuelProductKind = "PMS" | "AGO";

/**
 * Confirmed product.template External IDs: PMSL001 (PMS LOCAL), AGOL001 (AGO LOCAL).
 * Override at runtime only if needed: ODOO_PRODUCT_PMS_EXTERNAL_ID / ODOO_PRODUCT_AGO_EXTERNAL_ID.
 */
const FUEL_PRODUCT_EXTERNAL_IDS = (catalog.externalIds ?? {}) as Partial<Record<FuelProductKind, string | null>>;

/** Legacy numeric ids (aligned to LOCAL template numbers from 2026-10-08 export). */
const FUEL_PRODUCT_DEFAULTS = catalog.defaults as Partial<Record<FuelProductKind, number | null>>;

export function resolveFuelProductExternalId(kind: FuelProductKind): string | null {
  const fromEnv = (process.env[`ODOO_PRODUCT_${kind}_EXTERNAL_ID`] ?? "").trim();
  return fromEnv || FUEL_PRODUCT_EXTERNAL_IDS[kind] || null;
}

export function resolveFuelProductId(kind: FuelProductKind, explicitId?: number | null): number | null {
  return explicitId || FUEL_PRODUCT_DEFAULTS[kind] || null;
}
