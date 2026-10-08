/**
 * Confirmed quotation fulfillment model (2026-10-05).
 *
 * Only four loading warehouses are used for dealer fuel orders.
 * Station → warehouse is fixed; source location is fixed per warehouse.
 * Pricing is station-based via station.station.pricelist_id (not dealer).
 * Portal does not send unit price — Odoo applies the station pricelist.
 *
 * PFI = PDF from sale.order report `delivery_report.sale_pro_invoice_report`
 * (Sale PRO-FORMA Invoice). Sample: Sale_PRO-FORMA_Invoice_-_S01177.pdf
 * Quotation field on SO: station_id → station.station
 */

export const LOADING_WAREHOUSES = {
  KPC_ELDORET: {
    key: "KPC_ELDORET",
    name: "KPC ELDORET TERMINAL",
    odooWarehouseId: 66,
    odooWarehouseCode: "KPCED",
    sourceLocation: {
      name: "KPC-ELDORET/Stock",
      odooLocationId: 403,
    },
  },
  KPC_NAKURU: {
    key: "KPC_NAKURU",
    name: "KPC  NAKURU TERMINAL",
    odooWarehouseId: 67,
    odooWarehouseCode: "KPCNK",
    sourceLocation: {
      name: "KPC-NAKURU/Stock",
      odooLocationId: 409,
    },
  },
  KPC_KISUMU: {
    key: "KPC_KISUMU",
    name: "KPC KISUMU TERMINAL",
    odooWarehouseId: 68,
    odooWarehouseCode: "KPCKS",
    sourceLocation: {
      name: "KPC-KISUMU/Stock",
      odooLocationId: 415,
    },
  },
  LAKE_OIL_NRB: {
    key: "LAKE_OIL_NRB",
    name: "LAKE OIL GROUP (NBI)",
    odooWarehouseId: 63,
    odooWarehouseCode: "LakeO",
    sourceLocation: {
      name: "LakeO/Stock",
      odooLocationId: 385,
    },
  },
} as const;

export type LoadingWarehouseKey = keyof typeof LOADING_WAREHOUSES;

export type StationFulfillment = {
  portalCode: string;
  name: string;
  warehouseKey: LoadingWarehouseKey;
  /** station.station id for sale.order.station_id — null if not yet in Odoo */
  odooStationId: number | null;
  odooStationName: string | null;
  /** product.pricelist id on station.station — pricing is station-scoped */
  odooPricelistId: number | null;
};

/**
 * Station → loading warehouse (from Trinity) + station.station ids (from live Odoo).
 * Only 13 stations currently exist in station.station; the rest need creating in Odoo.
 */
export const STATION_FULFILLMENT: StationFulfillment[] = [
  // KPC ELDORET
  { portalCode: "kitale", name: "Kitale", warehouseKey: "KPC_ELDORET", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "outspan-eldoret", name: "Outspan Eldoret", warehouseKey: "KPC_ELDORET", odooStationId: 13, odooStationName: "OUTSPAN STATION", odooPricelistId: 6 },

  // KPC NAKURU
  { portalCode: "ol-joro-orok", name: "Ol'Joro-Orok", warehouseKey: "KPC_NAKURU", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "greensted", name: "Greensted", warehouseKey: "KPC_NAKURU", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "sobea", name: "Sobea", warehouseKey: "KPC_NAKURU", odooStationId: 14, odooStationName: "SOBEA STATION", odooPricelistId: 7 },
  { portalCode: "nakuru", name: "Nakuru", warehouseKey: "KPC_NAKURU", odooStationId: 16, odooStationName: "NAKURU TOWN STATION", odooPricelistId: 9 },

  // KPC KISUMU
  { portalCode: "mumias", name: "Mumias", warehouseKey: "KPC_KISUMU", odooStationId: 22, odooStationName: "MUMIAS STATION", odooPricelistId: 15 },
  { portalCode: "migori", name: "Migori", warehouseKey: "KPC_KISUMU", odooStationId: 21, odooStationName: "MIGORI  STATION", odooPricelistId: 14 },
  { portalCode: "kisii", name: "Kisii", warehouseKey: "KPC_KISUMU", odooStationId: 18, odooStationName: "KISII STATION", odooPricelistId: 11 },

  // LAKE OIL GROUP (NRB)
  { portalCode: "meru-gaitu", name: "Meru-Gaitu", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "athiriver", name: "Athiriver", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "rimpa", name: "Rimpa", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "kabati-kitui", name: "Kabati Kitui", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "thome", name: "Thome", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "maili-tatu", name: "Maili Tatu", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "banana", name: "Banana", warehouseKey: "LAKE_OIL_NRB", odooStationId: 1, odooStationName: "BANANA STATION", odooPricelistId: 4 },
  { portalCode: "magumu", name: "Magumu", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "kitanga", name: "Kitanga", warehouseKey: "LAKE_OIL_NRB", odooStationId: 19, odooStationName: "KITANGA  STATION", odooPricelistId: 12 },
  { portalCode: "maua-town", name: "Maua Town", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "kiserian", name: "Kiserian", warehouseKey: "LAKE_OIL_NRB", odooStationId: 2, odooStationName: "KISERIAN STATION", odooPricelistId: 2 },
  { portalCode: "dagoretti", name: "Dagoretti", warehouseKey: "LAKE_OIL_NRB", odooStationId: null, odooStationName: null, odooPricelistId: null },
  { portalCode: "kambiti", name: "Kambiti", warehouseKey: "LAKE_OIL_NRB", odooStationId: 12, odooStationName: "KAMBITI STATION", odooPricelistId: 5 },
];

export function fulfillmentForStation(stationCode: string) {
  const row = STATION_FULFILLMENT.find((s) => s.portalCode === stationCode);
  if (!row) return null;
  const wh = LOADING_WAREHOUSES[row.warehouseKey];
  return {
    ...row,
    warehouseId: wh.odooWarehouseId,
    warehouseName: wh.name,
    sourceLocationId: wh.sourceLocation.odooLocationId,
    sourceLocationName: wh.sourceLocation.name,
  };
}

export const QUOTATION_CREATE_CONTRACT = {
  saleType: "fuels" as const,
  substantialFields: [
    "partner_id", // dealer customer
    "sale_type", // fuels
    "station_id", // station.station — drives station pricelist
    "warehouse_id", // loading terminal from station map
    "source_location_id", // fixed from warehouse
    "order_line.product_id",
    "order_line.product_uom_qty",
  ],
  unitPriceSource: "temporary_epra_regional_by_warehouse",
  unitPriceStatus: "epra_temp_prices_active_until_station_pricelists_drive_odoo",
  pricingScope: "station" as const,
  pfi: {
    kind: "pdf_from_quotation" as const,
    reportId: 909,
    reportName: "delivery_report.sale_pro_invoice_report",
    reportLabel: "Sale PRO-FORMA Invoice",
    sampleDocument: "Sale_PRO-FORMA_Invoice_-_S01177.pdf",
  },
} as const;

/** Still awaiting / incomplete */
export const INTEGRATION_GAPS = [
  "station.station IDs missing in Odoo for: Kitale, Ol'Joro-Orok, Greensted, Meru-Gaitu, Athiriver, Rimpa, Kabati Kitui, Thome, Maili Tatu, Magumu, Maua Town, Dagoretti (create in Odoo or send IDs)",
  "Confirm warehouse/source IDs we prefilled from live Odoo (66/67/68/63 and 403/409/415/385)",
  "Replace temporary EPRA retail prices with station-discounted dealer wholesale once Odoo pricelists are authoritative",
  "Lubricants + LPG product.product IDs if orderable from portal",
  "Real dealer names + partner IDs for Kambiti, Dagoretti, Outspan placeholders",
] as const;
