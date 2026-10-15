/**
 * Temporary EPRA regional unit prices (KES/L) for portal → Odoo quotations.
 *
 * Source: EPRA maximum retail petroleum prices (press release, Annex I)
 * Period: 15 Oct 2026 – 14 Nov 2026. The list changes on the 15th of every month.
 * https://www.epra.go.ke/sites/default/files/2026-10/EPRA%20Press%20Release%20-Oct%20Fuel%20Prices.pdf
 * (The EPRA website price ticker still showed the Sep–Oct figures on 15 Oct; the press release is authoritative.)
 *
 * Warehouse region → EPRA town:
 * - LAKE_OIL_NRB  → Nairobi
 * - KPC_NAKURU    → Nakuru
 * - KPC_ELDORET   → Eldoret
 * - KPC_KISUMU    → Kisumu
 *
 * The table holds EPRA's published maximum *pump* prices unchanged; dealer unit prices are
 * those less STATION_DISCOUNT_KES. Replace once Odoo station pricelists are the source of truth.
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

/** EPRA maximum pump prices by loading-warehouse region (KES per litre), as published. */
export const EPRA_TEMP_PRICES_BY_WAREHOUSE: Record<LoadingWarehouseKey, EpraRegionPrices> = {
  LAKE_OIL_NRB: {
    region: "LAKE_OIL_NRB",
    epraTown: "Nairobi",
    pms: 226.96,
    ago: 227.76,
    periodFrom: "2026-10-15",
    periodTo: "2026-11-14",
  },
  KPC_NAKURU: {
    region: "KPC_NAKURU",
    epraTown: "Nakuru",
    pms: 225.73,
    ago: 226.93,
    periodFrom: "2026-10-15",
    periodTo: "2026-11-14",
  },
  KPC_ELDORET: {
    region: "KPC_ELDORET",
    epraTown: "Eldoret",
    pms: 226.51,
    ago: 227.71,
    periodFrom: "2026-10-15",
    periodTo: "2026-11-14",
  },
  KPC_KISUMU: {
    region: "KPC_KISUMU",
    epraTown: "Kisumu",
    pms: 226.51,
    ago: 227.71,
    periodFrom: "2026-10-15",
    periodTo: "2026-11-14",
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

/** Trinity's dealer discount off the EPRA price, KES per litre, for every station (PMS and AGO). */
export const STATION_DISCOUNT_KES = 3;

/** Dealer unit price: the EPRA price less the station discount, in whole cents. */
export function epraUnitPriceForWarehouse(
  warehouseKey: LoadingWarehouseKey,
  product: EpraFuelProduct
): number {
  const row = EPRA_TEMP_PRICES_BY_WAREHOUSE[warehouseKey];
  const epra = product === "PMS" ? row.pms : row.ago;
  return Math.round((epra - STATION_DISCOUNT_KES) * 100) / 100;
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
