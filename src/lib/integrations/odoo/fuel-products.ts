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
};

export const FUEL_PRODUCTS = catalog.products as FuelProduct[];

/** Recommended default product.product IDs for each kind (local bulk where available). */
export const FUEL_PRODUCT_DEFAULTS = catalog.defaults as Record<FuelProductKind, number | null>;

export function fuelProductsByKind(kind: FuelProductKind): FuelProduct[] {
  return FUEL_PRODUCTS.filter((p) => p.kind === kind);
}

export function resolveFuelProductId(
  kind: FuelProductKind,
  explicitId?: number | null
): number | null {
  if (explicitId) return explicitId;
  return FUEL_PRODUCT_DEFAULTS[kind] ?? null;
}
