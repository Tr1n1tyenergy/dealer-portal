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
    payment: "account.payment",
  },
} as const;

/** res.currency KES in Trinity's Odoo. */
export const ODOO_KES_CURRENCY_ID = 92;
/** account.journal "Mpesa": paybill payments arrive here posted, via Odoo's own M-PESA link. */
export const ODOO_MPESA_JOURNAL_ID = 11;

/**
 * Whether the portal creates, posts and cancels Odoo payments. Always with mock Odoo; with live
 * Odoo only once ODOO_PAYMENTS_LIVE=1 (after Adrian approves a live test). Off = confirm is portal-only.
 */
export function odooPaymentsEnabled(): boolean {
  return (process.env.ODOO_MODE ?? "mock") !== "live" || process.env.ODOO_PAYMENTS_LIVE === "1";
}

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
