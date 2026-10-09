import { FUEL_PRODUCT_DEFAULTS, resolveFuelProductId, type FuelProductKind } from "./fuel-products";

/**
 * Confirmed Trinity Energy Kenya Odoo mapping.
 * Models cross-checked against company Models.txt export (1097 models, 2026-10-01).
 * Fuel product IDs pulled live from product.product (see fuel-products.json).
 */
export const ODOO_TRINITY = {
  baseUrl: "https://trinityenergykenya.odoo.com",
  database: "trinityenergykenya-trinity-energy-production-15008827",
  host: "odoo.sh" as const,
  versionHint: "17",
  multiCompany: false,

  /** Commercial document path */
  salesApp: "Sales",
  /** Quotation = draft Sales Order (confirmed in Models.txt as `sale.order`) */
  quotationModel: "sale.order" as const,
  quotationLineModel: "sale.order.line" as const,
  quotationStateOnCreate: "draft",
  /** Human clicks "New" in Odoo to create the sales pro-forma (PFI). Portal does not auto-create PFI. */
  pfiCreation: "manual" as const,
  pfiKind: "sales_proforma" as const,

  /**
   * Stations are not unique Odoo entities — only the dealer (res.partner) matters.
   * Station name is stored on the quotation as a note / client_order_ref detail only.
   */
  stationMapping: "note_only" as const,

  /**
   * Pricing comes from the customer pricelist on the partner in Odoo.
   * Portal sends quantities only; Odoo applies dealer-specific prices.
   */
  pricing: "odoo_partner_pricelist" as const,

  /**
   * Technical model map for the dealer-order → quotation → PFI path.
   * Only models present in the company's Models.txt export are listed.
   */
  models: {
    partner: "res.partner",
    saleOrder: "sale.order",
    saleOrderLine: "sale.order.line",
    productVariant: "product.product",
    productTemplate: "product.template",
    pricelist: "product.pricelist",
    pricelistItem: "product.pricelist.item",
    uom: "uom.uom",
    uomCategory: "uom.category",
    stockWarehouse: "stock.warehouse",
    stockLocation: "stock.location",
    stockQuant: "stock.quant",
    accountMove: "account.move",
    accountMoveLine: "account.move.line",
    attachment: "ir.attachment",
    modelData: "ir.model.data",
    saleRequest: "sale.request",
    saleRequestLine: "sale.request.line",
    saleOrderApproval: "sale.order.approval",
    saleOrderTruck: "sale.order.truck",
    saleDeliveryLine: "sale.delivery.line",
  },

  /** Default product.product IDs for common fuel kinds (overridable via env). */
  fuelDefaults: FUEL_PRODUCT_DEFAULTS,
} as const;

export function odooEnv() {
  const envPms = Number(process.env.ODOO_PRODUCT_PMS_ID || 0) || null;
  const envAgo = Number(process.env.ODOO_PRODUCT_AGO_ID || 0) || null;
  const envIk = Number(process.env.ODOO_PRODUCT_IK_ID || 0) || null;
  const envJet = Number(process.env.ODOO_PRODUCT_JET_A1_ID || 0) || null;

  return {
    mode: (process.env.ODOO_MODE ?? "mock") as "mock" | "live",
    baseUrl: (process.env.ODOO_BASE_URL || ODOO_TRINITY.baseUrl).replace(/\/$/, ""),
    database: process.env.ODOO_DATABASE || ODOO_TRINITY.database,
    username: process.env.ODOO_USERNAME ?? "",
    apiKey: process.env.ODOO_API_KEY ?? "",
    /** product.product IDs — env overrides catalog defaults */
    productPmsId: resolveFuelProductId("PMS", envPms),
    productAgoId: resolveFuelProductId("AGO", envAgo),
    productIkId: resolveFuelProductId("IK", envIk),
    productJetA1Id: resolveFuelProductId("JET_A1", envJet),
  };
}

export function odooProductIdForKind(kind: FuelProductKind): number | null {
  const env = odooEnv();
  switch (kind) {
    case "PMS":
      return env.productPmsId;
    case "AGO":
      return env.productAgoId;
    case "IK":
      return env.productIkId;
    case "JET_A1":
      return env.productJetA1Id;
    default:
      return null;
  }
}

export function odooConfigured() {
  const env = odooEnv();
  return Boolean(env.baseUrl && env.database && env.username && env.apiKey);
}
