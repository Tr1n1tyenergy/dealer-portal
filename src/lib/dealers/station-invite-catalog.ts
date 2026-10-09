/**
 * Station-first invite catalog for Retail Interface dealer invites.
 * Primary label = station name (e.g. Kitanga). Trading name is stored for
 * post-activation portal display only.
 */
import officialDealers from "./official-dealers.json";
import { STATION_FULFILLMENT } from "@/lib/integrations/odoo/quotation-contract";

export type StationInviteCatalogRow = {
  stationCode: string;
  stationName: string;
  /** Shown as primary dealer label after activation */
  tradingName: string;
  orgCode: string;
  orgName: string;
  odooPartnerId: number | null;
  odooPartnerExternalId: string | null;
  odooStationExternalId: string | null;
  products: string[];
  /** Both partner + station External IDs present */
  invitable: boolean;
};

type OfficialStation = {
  code: string;
  name: string;
  tradingNameAsListed?: string;
  odooPartnerId?: number | null;
  odooExternalId?: string | null;
  products?: string[];
};

type OfficialDealer = {
  code: string;
  name: string;
  odooPartnerId?: number | null;
  isPlaceholder?: boolean;
  stations: OfficialStation[];
};

const dealers = officialDealers.dealers as OfficialDealer[];

function buildCatalog(): StationInviteCatalogRow[] {
  const byStation = new Map<string, StationInviteCatalogRow>();

  for (const dealer of dealers) {
    for (const st of dealer.stations) {
      const fulfillment = STATION_FULFILLMENT.find((s) => s.portalCode === st.code);
      const odooPartnerExternalId = st.odooExternalId ?? null;
      const odooStationExternalId = fulfillment?.odooStationExternalId ?? null;
      const odooPartnerId = st.odooPartnerId ?? dealer.odooPartnerId ?? null;
      const tradingName =
        st.tradingNameAsListed && st.tradingNameAsListed !== "TBC" && st.tradingNameAsListed !== "N/A"
          ? st.tradingNameAsListed
          : dealer.name;
      const row: StationInviteCatalogRow = {
        stationCode: st.code,
        stationName: st.name,
        tradingName,
        orgCode: dealer.code,
        orgName: dealer.name,
        odooPartnerId,
        odooPartnerExternalId,
        odooStationExternalId,
        products: st.products ?? officialDealers.defaultProducts ?? ["PMS", "AGO", "LUBRICANTS", "LPG"],
        invitable: Boolean(odooPartnerExternalId && odooStationExternalId),
      };
      byStation.set(st.code, row);
    }
  }

  // Ensure fulfillment stations appear even if missing from official list
  for (const f of STATION_FULFILLMENT) {
    if (byStation.has(f.portalCode)) continue;
    byStation.set(f.portalCode, {
      stationCode: f.portalCode,
      stationName: f.name,
      tradingName: f.name,
      orgCode: f.portalCode.toUpperCase().replace(/-/g, "_"),
      orgName: f.name,
      odooPartnerId: null,
      odooPartnerExternalId: null,
      odooStationExternalId: f.odooStationExternalId,
      products: ["PMS", "AGO", "LUBRICANTS", "LPG"],
      invitable: false,
    });
  }

  return Array.from(byStation.values()).sort((a, b) =>
    a.stationName.localeCompare(b.stationName)
  );
}

const CATALOG = buildCatalog();

export function listStationInviteCatalog(): StationInviteCatalogRow[] {
  return CATALOG;
}

export function getStationInviteRow(stationCode: string): StationInviteCatalogRow | null {
  return CATALOG.find((r) => r.stationCode === stationCode) ?? null;
}

export function listInvitableStations(): StationInviteCatalogRow[] {
  return CATALOG.filter((r) => r.invitable);
}
