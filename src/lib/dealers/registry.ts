import type { ProductCode } from "@prisma/client";
import catalog from "./official-dealers.json";

export type DealerProductCode = "PMS" | "AGO" | "LUBRICANTS" | "LPG";

export type OfficialStation = {
  code: string;
  name: string;
  tradingNameAsListed?: string;
  /** Numeric Odoo res.partner id (parsed from External ID) */
  odooPartnerId: number | null;
  odooExternalId?: string | null;
  odooStationPartnerId?: number | null;
  products: DealerProductCode[];
};

export type OfficialDealer = {
  code: string;
  name: string;
  /** True when trading name / partner id are temporary placeholders */
  isPlaceholder?: boolean;
  /** Org-level partner id when single-station; null when stations have distinct partners */
  odooPartnerId: number | null;
  stations: OfficialStation[];
  login: {
    email: string;
    firstName: string;
    lastName: string;
  };
};

export type UnassignedStation = {
  code: string;
  name: string;
  reason: "TBC" | "N/A" | string;
  odooPartnerId?: number | null;
  products: DealerProductCode[];
};

export const DEFAULT_DEALER_PRODUCTS = catalog.defaultProducts as DealerProductCode[];

export const OFFICIAL_DEALERS = catalog.dealers as OfficialDealer[];

export const UNASSIGNED_STATIONS = catalog.unassignedStations as UnassignedStation[];

export function parseProductsJson(raw: string | null | undefined): ProductCode[] {
  if (!raw) return DEFAULT_DEALER_PRODUCTS as ProductCode[];
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(Boolean) as ProductCode[];
  } catch {
    return DEFAULT_DEALER_PRODUCTS as ProductCode[];
  }
}

/** Prefer station partner id; fall back to org-level. */
export function resolveOdooPartnerId(
  stationPartnerId: number | null | undefined,
  orgPartnerId: number | null | undefined
): number | null {
  return stationPartnerId ?? orgPartnerId ?? null;
}
