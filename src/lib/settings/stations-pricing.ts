/**
 * Stations & Pricing aggregation for Platform Settings.
 * Base prices default to EPRA; dealer/transport margins come from StationFuelPrice.
 * Dealer price = (base − dealerMargin − transportMargin) / 1.08, truncated to 6 dp.
 * That calculated price is the system source of truth for PMS/AGO unit prices.
 */

import { prisma } from "@/lib/prisma";
import {
  dealerPriceFromParts,
} from "@/lib/integrations/odoo/dealer-prices";
import {
  EPRA_TEMP_PRICES_BY_WAREHOUSE,
  epraUnitPriceForStation,
} from "@/lib/integrations/odoo/epra-temp-prices";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";

export type SettingsFuel = "PMS" | "AGO";

export type StationFuelPricing = {
  fuel: SettingsFuel;
  /** EPRA default for the station region (KES/L), when mapped. */
  epraBasePriceKes: number | null;
  /** Effective base shown/edited (override ?? EPRA). */
  basePriceKes: number | null;
  /** True when staff saved an explicit base override. */
  basePriceOverridden: boolean;
  dealerMarginKes: number | null;
  transportMarginKes: number | null;
  /** (base − margins) / 1.08 truncated to 6 dp — authoritative ex-VAT unit price. */
  dealerPriceKes: number | null;
};

export type StationTankSummary = {
  id: string;
  tankKey: string;
  label: string;
  product: string;
  capacityLitres: number;
  active: boolean;
  createdAt: string;
};

export type StationPricingRow = {
  id: string;
  code: string | null;
  name: string;
  tradingName: string | null;
  locationLabel: string;
  dealerOrganizationId: string;
  dealerName: string;
  tankCount: number;
  tanks: StationTankSummary[];
  fuels: StationFuelPricing[];
  epraTown: string | null;
};

function parseProducts(json: string): SettingsFuel[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return ["PMS", "AGO"];
    const fuels = raw.filter((p): p is SettingsFuel => p === "PMS" || p === "AGO");
    return fuels.length ? fuels : ["PMS", "AGO"];
  } catch {
    return ["PMS", "AGO"];
  }
}

function locationForStation(code: string | null, epraTown: string | null): string {
  if (epraTown) return epraTown;
  if (!code) return "—";
  return code
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export { dealerPriceFromParts, truncateTo6Decimals } from "@/lib/integrations/odoo/dealer-prices";

export async function listStationsForPricing(): Promise<StationPricingRow[]> {
  const stations = await prisma.station.findMany({
    include: {
      dealerOrganization: { select: { id: true, name: true } },
      tanks: {
        orderBy: [{ sortOrder: "asc" }, { tankKey: "asc" }],
        select: {
          id: true,
          tankKey: true,
          label: true,
          product: true,
          capacityLitres: true,
          active: true,
          createdAt: true,
        },
      },
      fuelPrices: {
        where: { product: { in: ["PMS", "AGO"] } },
        select: {
          product: true,
          basePriceKes: true,
          dealerMarginKes: true,
          transportMarginKes: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return stations.map((st) => {
    const code = st.code;
    const fulfillment = code ? fulfillmentForStation(code) : null;
    const town = fulfillment ? EPRA_TEMP_PRICES_BY_WAREHOUSE[fulfillment.warehouseKey]?.epraTown ?? null : null;
    const priceByFuel = new Map(st.fuelPrices.map((p) => [p.product as SettingsFuel, p]));

    const fuelsConfigured = parseProducts(st.products);
    const fuels: StationFuelPricing[] = fuelsConfigured.map((fuel) => {
      const epra = code ? epraUnitPriceForStation(code, fuel) : null;
      const saved = priceByFuel.get(fuel);
      const overridden = saved?.basePriceKes != null;
      const base = overridden ? saved!.basePriceKes : epra;
      const dealerMargin = saved?.dealerMarginKes ?? null;
      const transportMargin = saved?.transportMarginKes ?? null;
      return {
        fuel,
        epraBasePriceKes: epra,
        basePriceKes: base,
        basePriceOverridden: overridden,
        dealerMarginKes: dealerMargin,
        transportMarginKes: transportMargin,
        dealerPriceKes: dealerPriceFromParts(base, dealerMargin, transportMargin),
      };
    });

    return {
      id: st.id,
      code: st.code,
      name: st.name,
      tradingName: st.tradingName,
      locationLabel: locationForStation(st.code, town),
      dealerOrganizationId: st.dealerOrganizationId,
      dealerName: st.dealerOrganization.name,
      tankCount: st.tanks.filter((t) => t.active).length,
      tanks: st.tanks.map((t) => ({
        id: t.id,
        tankKey: t.tankKey,
        label: t.label,
        product: t.product,
        capacityLitres: t.capacityLitres,
        active: t.active,
        createdAt: t.createdAt.toISOString(),
      })),
      fuels,
      epraTown: town,
    };
  });
}

export async function listDealerOptions(): Promise<Array<{ id: string; name: string }>> {
  return prisma.dealerOrganization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
