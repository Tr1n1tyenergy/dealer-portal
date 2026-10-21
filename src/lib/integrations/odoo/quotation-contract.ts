/**
 * Confirmed quotation fulfillment model.
 *
 * Only four loading warehouses are used for dealer fuel orders.
 * Station → warehouse is fixed; source location is fixed per warehouse.
 * Stable Odoo identifiers are External IDs (`__export__.…`); live JSON-RPC
 * resolves them to database IDs via ir.model.data before writing sale.order.
 *
 * PFI = PDF from sale.order report `delivery_report.sale_pro_invoice_report`
 * (Sale PRO-FORMA Invoice). Sample: Sale_PRO-FORMA_Invoice_-_S01177.pdf
 * Quotation station identifier: Odoo External ID (resolved at live sync).
 * Banana was provided as account.analytic.account — confirm this matches the
 * Station field on sale.order (vs station.station) before full cutover.
 */

/**
 * Source-location candidates from Odoo stock.quant export (2026-10-08).
 * These External IDs are stock.quant rows (product @ location), not stock.location.
 * Live sync reads quant.location_id to set sale.order.source_location_id.
 * Switch active pick via odooLocationExternalId or env ODOO_SOURCE_LOCATION_<WH>_EXTERNAL_ID.
 */
export type SourceLocationCandidate = {
  key: string;
  externalId: string;
  productCode: string;
  productName: string;
};

export type SourceLocationConfig = {
  name: string;
  /** Active candidate External ID used for live quotation create */
  odooLocationExternalId: string | null;
  candidates: SourceLocationCandidate[];
};

/**
 * Locked trial mapping (2026-10-13): one active source-location External ID per warehouse.
 * Picked from the stock.quant export list — PMS LOCAL quant for each terminal.
 * Live client resolves quant → stock.location id before writing sale.order.source_location_id.
 * Ops can still override via ODOO_SOURCE_LOCATION_*_EXTERNAL_ID.
 */
export const ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS = {
  KPC_ELDORET: "__export__.stock_quant_9382_5fced216", // KPC-ELDORET/Stock via PMS LOCAL quant
  KPC_NAKURU: "__export__.stock_quant_10902_860a9d8d", // KPC-NAKURU/Stock via PMS LOCAL quant
  KPC_KISUMU: "__export__.stock_quant_9384_2d26b934", // KPC-KISUMU/Stock via PMS LOCAL quant
  LAKE_OIL_NRB: "__export__.stock_quant_9329_2b09d1f5", // LakeO/Stock via PMS LOCAL quant
} as const satisfies Record<string, string>;

export const LOADING_WAREHOUSES: Record<
  string,
  {
    key: string;
    name: string;
    odooWarehouseExternalId: string;
    odooWarehouseCode: string;
    sourceLocation: SourceLocationConfig;
  }
> = {
  KPC_ELDORET: {
    key: "KPC_ELDORET",
    name: "KPC ELDORET TERMINAL",
    odooWarehouseExternalId: "__export__.stock_warehouse_141_2be39467",
    odooWarehouseCode: "KPCED",
    sourceLocation: {
      name: "KPC-ELDORET/Stock",
      odooLocationExternalId: ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS.KPC_ELDORET,
      candidates: [
        {
          key: "ELDORET_AGO_EXPORT",
          externalId: "__export__.stock_quant_9449_75b9ceed",
          productCode: "AGOE001",
          productName: "AGO EXPORT",
        },
        {
          key: "ELDORET_AGO_LOCAL",
          externalId: "__export__.stock_quant_11568_fc1e067b",
          productCode: "AGOL001",
          productName: "AGO LOCAL",
        },
        {
          key: "ELDORET_PMS_EXPORT",
          externalId: "__export__.stock_quant_9393_467dc15f",
          productCode: "PMSE001",
          productName: "PMS EXPORT",
        },
        {
          key: "ELDORET_PMS_LOCAL",
          externalId: "__export__.stock_quant_9382_5fced216",
          productCode: "PMSL001",
          productName: "PMS LOCAL",
        },
      ],
    },
  },
  KPC_NAKURU: {
    key: "KPC_NAKURU",
    name: "KPC  NAKURU TERMINAL",
    odooWarehouseExternalId: "__export__.stock_warehouse_143_2ab4577e",
    odooWarehouseCode: "KPCNK",
    sourceLocation: {
      name: "KPC-NAKURU/Stock",
      odooLocationExternalId: ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS.KPC_NAKURU,
      candidates: [
        {
          key: "NAKURU_PMS_LOCAL",
          externalId: "__export__.stock_quant_10902_860a9d8d",
          productCode: "PMSL001",
          productName: "PMS LOCAL",
        },
        {
          key: "NAKURU_AGO_EXPORT",
          externalId: "__export__.stock_quant_11588_69fb8c73",
          productCode: "AGOE001",
          productName: "AGO EXPORT",
        },
        {
          key: "NAKURU_AGO_LOCAL",
          externalId: "__export__.stock_quant_9385_066bd768",
          productCode: "AGOL001",
          productName: "AGO LOCAL",
        },
        {
          key: "NAKURU_PMS_EXPORT",
          externalId: "__export__.stock_quant_9082_838c0f7d",
          productCode: "PMSE001",
          productName: "PMS EXPORT",
        },
      ],
    },
  },
  KPC_KISUMU: {
    key: "KPC_KISUMU",
    name: "KPC KISUMU TERMINAL",
    odooWarehouseExternalId: "__export__.stock_warehouse_144_1efecfce",
    odooWarehouseCode: "KPCKS",
    sourceLocation: {
      name: "KPC-KISUMU/Stock",
      odooLocationExternalId: ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS.KPC_KISUMU,
      candidates: [
        {
          key: "KISUMU_AGO_LOCAL",
          externalId: "__export__.stock_quant_38853_699e2bca",
          productCode: "AGOL001",
          productName: "AGO LOCAL",
        },
        {
          key: "KISUMU_PMS_LOCAL",
          externalId: "__export__.stock_quant_9384_2d26b934",
          productCode: "PMSL001",
          productName: "PMS LOCAL",
        },
      ],
    },
  },
  LAKE_OIL_NRB: {
    key: "LAKE_OIL_NRB",
    name: "LAKE OIL GROUP (NBI)",
    odooWarehouseExternalId: "__export__.stock_warehouse_138_2263a4fc",
    odooWarehouseCode: "LakeO",
    sourceLocation: {
      name: "LakeO/Stock",
      odooLocationExternalId: ACTIVE_SOURCE_LOCATION_EXTERNAL_IDS.LAKE_OIL_NRB,
      candidates: [
        {
          key: "LAKEO_AGO_LOCAL",
          externalId: "__export__.stock_quant_9288_a1243fdf",
          productCode: "AGOL001",
          productName: "AGO LOCAL",
        },
        {
          key: "LAKEO_PMS_LOCAL",
          externalId: "__export__.stock_quant_9329_2b09d1f5",
          productCode: "PMSL001",
          productName: "PMS LOCAL",
        },
      ],
    },
  },
};

export type LoadingWarehouseKey = keyof typeof LOADING_WAREHOUSES;

const SOURCE_LOCATION_ENV: Record<LoadingWarehouseKey, string> = {
  KPC_ELDORET: "ODOO_SOURCE_LOCATION_KPC_ELDORET_EXTERNAL_ID",
  KPC_NAKURU: "ODOO_SOURCE_LOCATION_KPC_NAKURU_EXTERNAL_ID",
  KPC_KISUMU: "ODOO_SOURCE_LOCATION_KPC_KISUMU_EXTERNAL_ID",
  LAKE_OIL_NRB: "ODOO_SOURCE_LOCATION_LAKE_OIL_NRB_EXTERNAL_ID",
};

/** Active source-location External ID for a warehouse (env override wins). */
export function resolveSourceLocationExternalId(warehouseKey: LoadingWarehouseKey): string | null {
  const envName = SOURCE_LOCATION_ENV[warehouseKey];
  const fromEnv = (process.env[envName] ?? "").trim();
  if (fromEnv) return fromEnv;
  return LOADING_WAREHOUSES[warehouseKey].sourceLocation.odooLocationExternalId;
}

export type StationFulfillment = {
  portalCode: string;
  name: string;
  warehouseKey: LoadingWarehouseKey;
  /**
   * Preferred: Odoo External ID for the station record used on quotations.
   * Banana example is account.analytic.account (not station.station).
   */
  odooStationExternalId: string | null;
  /** Display name in Odoo, when known */
  odooStationName: string | null;
  /** Legacy numeric id — used only when External ID is not yet set */
  odooStationId: number | null;
  /** product.pricelist id when known — pricing is station-scoped */
  odooPricelistId: number | null;
};

function station(
  portalCode: string,
  name: string,
  warehouseKey: LoadingWarehouseKey,
  opts: {
    odooStationExternalId?: string | null;
    odooStationName?: string | null;
    odooStationId?: number | null;
    odooPricelistId?: number | null;
  } = {}
): StationFulfillment {
  return {
    portalCode,
    name,
    warehouseKey,
    odooStationExternalId: opts.odooStationExternalId ?? null,
    odooStationName: opts.odooStationName ?? null,
    odooStationId: opts.odooStationId ?? null,
    odooPricelistId: opts.odooPricelistId ?? null,
  };
}

/**
 * Station → loading warehouse + Odoo station External ID (when provided).
 * IDs from the Odoo account.analytic.account export of 2026-10-15. Malaa, Mariakani and Outspan each
 * have a second account in Odoo (146, 147, 151); the ones below are in use until the Odoo admin confirms.
 */
export const STATION_FULFILLMENT: StationFulfillment[] = [
  // KPC ELDORET
  station("kitale", "Kitale", "KPC_ELDORET", {
    odooStationExternalId: "__export__.account_analytic_account_143_5a6308ab",
    odooStationName: "KITALE STATION",
  }),
  station("outspan-eldoret", "Outspan Eldoret", "KPC_ELDORET", {
    odooStationExternalId: "__export__.account_analytic_account_5_46f067c5",
    odooStationName: "OUTSPAN STATION",
    odooPricelistId: 6,
  }),

  // KPC NAKURU
  station("ol-joro-orok", "Ol'Joro-Orok", "KPC_NAKURU", {
    odooStationExternalId: "__export__.account_analytic_account_150_ae4945f6",
    odooStationName: "OLJOROROK STATION",
  }),
  station("greensted", "Greensted", "KPC_NAKURU", {
    odooStationExternalId: "__export__.account_analytic_account_139_a6e7a612",
    odooStationName: "GREENSTED STATION",
  }),
  station("sobea", "Sobea", "KPC_NAKURU", {
    odooStationExternalId: "__export__.account_analytic_account_9_0cc2c2de",
    odooStationName: "SOBEA STATION",
    odooPricelistId: 7,
  }),
  station("nakuru", "Nakuru", "KPC_NAKURU", {
    odooStationExternalId: "__export__.account_analytic_account_4_a1852057",
    odooStationName: "NAKURU TOWN STATION",
    odooPricelistId: 9,
  }),

  // KPC KISUMU
  station("mumias", "Mumias", "KPC_KISUMU", {
    odooStationExternalId: "__export__.account_analytic_account_7_54337094",
    odooStationName: "MUMIAS STATION",
    odooPricelistId: 15,
  }),
  station("migori", "Migori", "KPC_KISUMU", {
    odooStationExternalId: "__export__.account_analytic_account_128_330c5416",
    odooStationName: "MIGORI  STATION",
    odooPricelistId: 14,
  }),
  station("kisii", "Kisii", "KPC_KISUMU", {
    odooStationExternalId: "__export__.account_analytic_account_142_05fb5c2b",
    odooStationName: "KISII STATION",
    odooPricelistId: 11,
  }),

  // LAKE OIL GROUP (NRB)
  station("meru-gaitu", "Meru-Gaitu", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_149_7854a54b",
    odooStationName: "MERU GAITU STATION",
  }),
  station("athiriver", "Athiriver", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_137_1bc29443",
    odooStationName: "ATHI RIVER STATION",
  }),
  station("rimpa", "Rimpa", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_136_24fd484a",
    odooStationName: "RIMPA STATION",
  }),
  station("kabati-kitui", "Kabati Kitui", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_141_6a6f482b",
    odooStationName: "KABATI KITUI STATION",
  }),
  station("thome", "Thome", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_152_55d29a81",
    odooStationName: "THOME STATION",
  }),
  station("maili-tatu", "Maili Tatu", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_145_147ddc2d",
    odooStationName: "MAILI TATU STATION",
  }),
  station("malaa", "Malaa", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_6_fc268fb1",
    odooStationName: "MALAA STATION",
  }),
  station("mariakani", "Mariakani", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_3_1462ffa8",
    odooStationName: "MARIAKANI STATION",
  }),
  station("banana", "Banana", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_1_7bdf628f",
    odooStationName: "BANANA STATION",
    odooPricelistId: 4,
  }),
  station("magumu", "Magumu", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_144_ecb08948",
    odooStationName: "MAGUMU STATION",
  }),
  station("kitanga", "Kitanga", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_130_9dc98478",
    odooStationName: "KITANGA  STATION",
    odooPricelistId: 12,
  }),
  station("maua-town", "Maua Town", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_148_13dbdb6a",
    odooStationName: "MAUA TOWN STATION",
  }),
  station("kiserian", "Kiserian", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_2_687baa4d",
    odooStationName: "KISERIAN STATION",
    odooPricelistId: 2,
  }),
  station("dagoretti", "Dagoretti", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_138_021e1f39",
    odooStationName: "DAGORETTI STATION",
  }),
  station("kambiti", "Kambiti", "LAKE_OIL_NRB", {
    odooStationExternalId: "__export__.account_analytic_account_8_13ad42a3",
    odooStationName: "KAMBITI STATION",
    odooPricelistId: 5,
  }),
];

export function fulfillmentForStation(stationCode: string) {
  const row = STATION_FULFILLMENT.find((s) => s.portalCode === stationCode);
  if (!row) return null;
  const wh = LOADING_WAREHOUSES[row.warehouseKey];
  return {
    ...row,
    warehouseKey: row.warehouseKey,
    warehouseExternalId: wh.odooWarehouseExternalId,
    warehouseName: wh.name,
    sourceLocationExternalId: resolveSourceLocationExternalId(row.warehouseKey),
    sourceLocationName: wh.sourceLocation.name,
    sourceLocationCandidates: wh.sourceLocation.candidates,
  };
}
