/**
 * Temporary EPRA regional unit prices (KES/L) for portal → Odoo quotations.
 *
 * Source: EPRA maximum retail petroleum prices
 * Period: 15 Sep 2026 – 14 Oct 2026
 * https://www.epra.go.ke/maximum-retail-petroleum-prices-kenya-period-15th-september-2026-14th-october-2026
 *
 * Warehouse region → EPRA town:
 * - LAKE_OIL_NRB  → Nairobi
 * - KPC_NAKURU    → Nakuru
 * - KPC_ELDORET   → Eldoret
 * - KPC_KISUMU    → Kisumu
 *
 * NOTE: These are EPRA maximum *retail* pump prices. Sample PFIs use lower
 * dealer/wholesale unit prices. Replace with station-discounted dealer prices
 * once Odoo station pricelists are the source of truth.
 */

import type { LoadingWarehouseKey } from "./quotation-contract";
import { STATION_FULFILLMENT, fulfillmentForStation } from "./quotation-contract";

export type EpraFuelProduct = "PMS" | "AGO";

export type EpraRegionPrices = {
  region: string;
  epraTown: string;
  pms: number;
  ago: number;
  periodFrom: string;
  periodTo: string;
};

/** EPRA max retail prices by loading-warehouse region (KES per litre). */
export const EPRA_TEMP_PRICES_BY_WAREHOUSE: Record<LoadingWarehouseKey, EpraRegionPrices> = {
  LAKE_OIL_NRB: {
    region: "LAKE_OIL_NRB",
    epraTown: "Nairobi",
    pms: 214.03,
    ago: 217.86,
    periodFrom: "2026-09-15",
    periodTo: "2026-10-14",
  },
  KPC_NAKURU: {
    region: "KPC_NAKURU",
    epraTown: "Nakuru",
    pms: 212.92,
    ago: 217.27,
    periodFrom: "2026-09-15",
    periodTo: "2026-10-14",
  },
  KPC_ELDORET: {
    region: "KPC_ELDORET",
    epraTown: "Eldoret",
    pms: 213.69,
    ago: 218.09,
    periodFrom: "2026-09-15",
    periodTo: "2026-10-14",
  },
  KPC_KISUMU: {
    region: "KPC_KISUMU",
    epraTown: "Kisumu",
    pms: 213.69,
    ago: 218.08,
    periodFrom: "2026-09-15",
    periodTo: "2026-10-14",
  },
};

/**
 * sale.order.line fields used when creating quotation lines
 * (confirmed via Odoo developer tooltips 2026-10-07).
 *
 * UI "Product" widget is product_template_id → product.template;
 * API create uses product_id → product.product (variant) which we already hold.
 */
export const SALE_ORDER_LINE_FIELDS = {
  product_template_id: {
    label: "Product Template",
    model: "sale.order.line",
    type: "many2one",
    relation: "product.template",
    note: "UI selector; API prefers product_id (variant).",
  },
  product_id: {
    label: "Product",
    model: "sale.order.line",
    type: "many2one",
    relation: "product.product",
    note: "What we send from fuel-products.json / env IDs.",
  },
  product_uom_qty: {
    label: "Quantity",
    model: "sale.order.line",
    type: "float",
    required: true,
    note: "Litres from dealer portal order amount.",
  },
  price_unit: {
    label: "Unit Price",
    model: "sale.order.line",
    type: "float",
    required: true,
    note: "Temporary: EPRA regional price until station pricelists drive this.",
  },
} as const;

export function epraUnitPriceForWarehouse(
  warehouseKey: LoadingWarehouseKey,
  product: EpraFuelProduct
): number {
  const row = EPRA_TEMP_PRICES_BY_WAREHOUSE[warehouseKey];
  return product === "PMS" ? row.pms : row.ago;
}

/** Resolve temporary unit price for a portal station code. */
export function epraUnitPriceForStation(
  stationCode: string,
  product: EpraFuelProduct
): number | null {
  const fulfillment = fulfillmentForStation(stationCode);
  if (!fulfillment) return null;
  return epraUnitPriceForWarehouse(fulfillment.warehouseKey, product);
}

/** Flat station → { pms, ago, region } for debugging / admin. */
export function stationEpraPriceTable() {
  return STATION_FULFILLMENT.map((s) => {
    const prices = EPRA_TEMP_PRICES_BY_WAREHOUSE[s.warehouseKey];
    return {
      stationCode: s.portalCode,
      stationName: s.name,
      warehouse: s.warehouseKey,
      epraTown: prices.epraTown,
      pms: prices.pms,
      ago: prices.ago,
      period: `${prices.periodFrom} → ${prices.periodTo}`,
    };
  });
}
