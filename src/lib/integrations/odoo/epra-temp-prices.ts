/**
 * Temporary EPRA regional unit prices (KES/L) for portal → Odoo quotations.
 *
 * Source: EPRA maximum retail petroleum prices (press release, Annex I)
 * Period: 15 Nov 2026 – 14 Dec 2026 (press release signed 14 Nov 2026). The list changes on the 15th of every month.
 * EPRA left PMS, AGO and kerosene unchanged for this period, so the four towns below carry the same
 * prices as 15 Oct – 14 Nov (Nairobi 226.96/227.76, Nakuru 225.73/226.93, Eldoret and Kisumu 226.51/227.71).
 *
 * Warehouse region → EPRA town:
 * - LAKE_OIL_NRB  → Nairobi
 * - KPC_NAKURU    → Nakuru
 * - KPC_ELDORET   → Eldoret
 * - KPC_KISUMU    → Kisumu
 *
 * The table holds EPRA's published maximum *pump* prices unchanged, and dealers pay them as they are
 * (the KSh 3 station discount ended in October 2026). Replace once Odoo pricelists are the source of truth.
 */

import type { LoadingWarehouseKey } from "./quotation-contract";
import { fulfillmentForStation } from "./quotation-contract";

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
    periodFrom: "2026-11-15",
    periodTo: "2026-12-14",
  },
  KPC_NAKURU: {
    region: "KPC_NAKURU",
    epraTown: "Nakuru",
    pms: 225.73,
    ago: 226.93,
    periodFrom: "2026-11-15",
    periodTo: "2026-12-14",
  },
  KPC_ELDORET: {
    region: "KPC_ELDORET",
    epraTown: "Eldoret",
    pms: 226.51,
    ago: 227.71,
    periodFrom: "2026-11-15",
    periodTo: "2026-12-14",
  },
  KPC_KISUMU: {
    region: "KPC_KISUMU",
    epraTown: "Kisumu",
    pms: 226.51,
    ago: 227.71,
    periodFrom: "2026-11-15",
    periodTo: "2026-12-14",
  },
};

/** Dealer unit price: the EPRA price for the station's loading region. */
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
