import { resolveFuelProductId, type FuelProductKind } from "./fuel-products";

/** Trinity Energy Kenya's Odoo (odoo.sh, v17) and the models the portal uses. */
export const ODOO_TRINITY = {
  baseUrl: "https://trinityenergykenya.odoo.com",
  database: "trinityenergykenya-trinity-energy-production-15008827",
  models: {
    partner: "res.partner",
    saleOrder: "sale.order",
    productVariant: "product.product",
    productTemplate: "product.template",
    stockLocation: "stock.location",
    stockQuant: "stock.quant",
    modelData: "ir.model.data",
  },
} as const;

export function odooEnv() {
  const envPms = Number(process.env.ODOO_PRODUCT_PMS_ID || 0) || null;
  const envAgo = Number(process.env.ODOO_PRODUCT_AGO_ID || 0) || null;

  return {
    mode: (process.env.ODOO_MODE ?? "mock") as "mock" | "live",
    baseUrl: (process.env.ODOO_BASE_URL || ODOO_TRINITY.baseUrl).replace(/\/$/, ""),
    database: process.env.ODOO_DATABASE || ODOO_TRINITY.database,
    username: process.env.ODOO_USERNAME ?? "",
    apiKey: process.env.ODOO_API_KEY ?? "",
    /** product.product IDs — env overrides catalog defaults */
    productPmsId: resolveFuelProductId("PMS", envPms),
    productAgoId: resolveFuelProductId("AGO", envAgo),
  };
}

export function odooProductIdForKind(kind: FuelProductKind): number | null {
  const env = odooEnv();
  return kind === "PMS" ? env.productPmsId : env.productAgoId;
}

export function odooConfigured() {
  const env = odooEnv();
  return Boolean(env.baseUrl && env.database && env.username && env.apiKey);
}
