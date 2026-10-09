import catalog from "./fuel-products.json";

/** Canonical fuel kinds used by the dealer portal / Odoo bridge. */
export type FuelProductKind = "PMS" | "AGO" | "IK" | "JET_A1" | "OTHER_FUEL";

export type FuelProduct = {
  id: number;
  code: string;
  name: string;
  kind: FuelProductKind;
  category: string;
  uom: string;
  sale_ok?: boolean;
  active?: boolean;
  /** Preferred stable identifier when known */
  externalId?: string | null;
};

export type FuelProductCandidate = {
  key: string;
  externalId: string;
  code: string;
  name: string;
  onHand?: number;
};

export const FUEL_PRODUCTS = catalog.products as FuelProduct[];

/** All PMS/AGO product.template External ID candidates for live cutover testing. */
export const FUEL_PRODUCT_CANDIDATES = (catalog.productCandidates ?? {}) as Partial<
  Record<FuelProductKind, FuelProductCandidate[]>
>;

/**
 * Confirmed product.template External IDs: PMSL001 (PMS LOCAL), AGOL001 (AGO LOCAL).
 * Override at runtime only if needed: ODOO_PRODUCT_PMS_EXTERNAL_ID / ODOO_PRODUCT_AGO_EXTERNAL_ID.
 */
export const FUEL_PRODUCT_EXTERNAL_IDS = (catalog.externalIds ?? {}) as Partial<
  Record<FuelProductKind, string | null>
>;

/** Legacy numeric ids (aligned to LOCAL template numbers from 2026-10-08 export). */
export const FUEL_PRODUCT_DEFAULTS = catalog.defaults as Record<FuelProductKind, number | null>;

export function fuelProductsByKind(kind: FuelProductKind): FuelProduct[] {
  return FUEL_PRODUCTS.filter((p) => p.kind === kind);
}

export function fuelProductCandidates(kind: FuelProductKind): FuelProductCandidate[] {
  return FUEL_PRODUCT_CANDIDATES[kind] ?? [];
}

export function resolveFuelProductExternalId(kind: FuelProductKind): string | null {
  const envKey =
    kind === "PMS"
      ? "ODOO_PRODUCT_PMS_EXTERNAL_ID"
      : kind === "AGO"
        ? "ODOO_PRODUCT_AGO_EXTERNAL_ID"
        : kind === "IK"
          ? "ODOO_PRODUCT_IK_EXTERNAL_ID"
          : kind === "JET_A1"
            ? "ODOO_PRODUCT_JET_A1_EXTERNAL_ID"
            : null;
  if (envKey) {
    const fromEnv = (process.env[envKey] ?? "").trim();
    if (fromEnv) return fromEnv;
  }
  return FUEL_PRODUCT_EXTERNAL_IDS[kind] ?? null;
}

export function resolveFuelProductId(
  kind: FuelProductKind,
  explicitId?: number | null
): number | null {
  if (explicitId) return explicitId;
  return FUEL_PRODUCT_DEFAULTS[kind] ?? null;
}
