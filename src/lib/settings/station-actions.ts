"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

type FuelKey = "PMS" | "AGO";

function parseOptionalNumber(raw: FormDataEntryValue | null, label: string): number | null | { error: string } {
  if (raw == null) return null;
  const text = String(raw).replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < 0) return { error: `${label} cannot be negative.` };
  if (n > 1_000_000) return { error: `${label} is out of range.` };
  return Math.round(n * 1e6) / 1e6;
}

function revalidateSettings() {
  revalidatePath("/intelligence/retail/settings");
  revalidatePath("/intelligence/admin/settings");
}

export async function createStationAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    return { ok: false, error: "You do not have permission to create stations." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const dealerOrganizationId = String(formData.get("dealerOrganizationId") ?? "").trim();
  const tradingName = String(formData.get("tradingName") ?? "").trim() || null;
  const codeRaw = String(formData.get("code") ?? "").trim();
  const code = codeRaw ? slugify(codeRaw) : slugify(name);

  if (name.length < 2) return { ok: false, error: "Station name is required." };
  if (!dealerOrganizationId) return { ok: false, error: "Select a dealer organisation." };
  if (!code) return { ok: false, error: "Station code is required." };

  const dealer = await prisma.dealerOrganization.findUnique({ where: { id: dealerOrganizationId } });
  if (!dealer) return { ok: false, error: "Dealer organisation not found." };

  const existing = await prisma.station.findUnique({ where: { code } });
  if (existing) return { ok: false, error: `Station code “${code}” already exists.` };

  const created = await prisma.station.create({
    data: {
      name,
      code,
      tradingName,
      dealerOrganizationId,
      products: '["PMS","AGO"]',
      tankCount: 0,
      pumpCount: 0,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "STATION_CREATED",
    entity: "Station",
    entityId: created.id,
    meta: { name, code, stationId: created.id, stationName: name, dealerOrganizationId },
  });

  revalidateSettings();
  return { ok: true };
}

/** Legacy modal update (dealer reassignment). Prefer updateStationPricingAction for inline edit. */
export async function updateStationAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    return { ok: false, error: "You do not have permission to edit stations." };
  }

  const id = String(formData.get("stationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const dealerOrganizationId = String(formData.get("dealerOrganizationId") ?? "").trim();
  const tradingName = String(formData.get("tradingName") ?? "").trim() || null;

  if (!id) return { ok: false, error: "Missing station." };
  if (name.length < 2) return { ok: false, error: "Station name is required." };
  if (!dealerOrganizationId) return { ok: false, error: "Select a dealer organisation." };

  const station = await prisma.station.findUnique({ where: { id } });
  if (!station) return { ok: false, error: "Station not found." };

  const dealer = await prisma.dealerOrganization.findUnique({ where: { id: dealerOrganizationId } });
  if (!dealer) return { ok: false, error: "Dealer organisation not found." };

  await prisma.station.update({
    where: { id },
    data: { name, tradingName, dealerOrganizationId },
  });

  await logActivity({
    actorId: session.user.id,
    action: "STATION_UPDATED",
    entity: "Station",
    entityId: id,
    meta: {
      name,
      stationId: id,
      stationName: name,
      dealerOrganizationId,
      before: {
        name: station.name,
        tradingName: station.tradingName,
        dealerOrganizationId: station.dealerOrganizationId,
      },
      after: { name, tradingName, dealerOrganizationId },
    },
  });

  revalidateSettings();
  return { ok: true };
}

/**
 * Edit Station modal save: station name + per-fuel base / dealer margin / transport margin.
 * Dealer organisation and fuel types are not editable here.
 * Dealer price = (base − dealerMargin − transportMargin) / 1.08, truncated to 6 dp (not rounded).
 */
export async function updateStationPricingAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    return { ok: false, error: "You do not have permission to edit stations." };
  }

  const id = String(formData.get("stationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: "Missing station." };
  if (name.length < 2) return { ok: false, error: "Station name is required." };

  const station = await prisma.station.findUnique({
    where: { id },
    include: { fuelPrices: true },
  });
  if (!station) return { ok: false, error: "Station not found." };

  const fuels: FuelKey[] = ["PMS", "AGO"];
  const rows: Array<{
    product: FuelKey;
    basePriceKes: number | null;
    dealerMarginKes: number | null;
    transportMarginKes: number | null;
  }> = [];

  for (const fuel of fuels) {
    const baseText = String(formData.get(`base_${fuel}`) ?? "").trim();
    if (!baseText) return { ok: false, error: `${fuel} base price is required.` };
    const baseRaw = parseOptionalNumber(baseText, `${fuel} base price`);
    if (baseRaw && typeof baseRaw === "object" && "error" in baseRaw) return { ok: false, error: baseRaw.error };
    if (baseRaw == null) return { ok: false, error: `${fuel} base price is required.` };

    const marginRaw = parseOptionalNumber(formData.get(`dealerMargin_${fuel}`), `${fuel} dealer margin`);
    if (marginRaw && typeof marginRaw === "object" && "error" in marginRaw) {
      return { ok: false, error: marginRaw.error };
    }
    const transportRaw = parseOptionalNumber(formData.get(`transportMargin_${fuel}`), `${fuel} transport margin`);
    if (transportRaw && typeof transportRaw === "object" && "error" in transportRaw) {
      return { ok: false, error: transportRaw.error };
    }

    const epra = station.code ? epraUnitPriceForStation(station.code, fuel) : null;
    const basePriceKes = baseRaw as number;
    // Treat value matching EPRA as “use EPRA” so monthly EPRA updates still flow through.
    const storeBase =
      epra != null && Math.abs(basePriceKes - epra) < 0.0005 ? null : basePriceKes;

    rows.push({
      product: fuel,
      basePriceKes: storeBase,
      dealerMarginKes: marginRaw as number | null,
      transportMarginKes: transportRaw as number | null,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (station.name !== name) {
      await tx.station.update({ where: { id }, data: { name } });
    }

    for (const row of rows) {
      const empty = row.basePriceKes == null && row.dealerMarginKes == null && row.transportMarginKes == null;
      const existing = station.fuelPrices.find((p) => p.product === row.product);
      if (empty) {
        if (existing) {
          await tx.stationFuelPrice.delete({ where: { id: existing.id } });
        }
        continue;
      }
      await tx.stationFuelPrice.upsert({
        where: { stationId_product: { stationId: id, product: row.product } },
        create: {
          stationId: id,
          product: row.product,
          basePriceKes: row.basePriceKes,
          dealerMarginKes: row.dealerMarginKes,
          transportMarginKes: row.transportMarginKes,
        },
        update: {
          basePriceKes: row.basePriceKes,
          dealerMarginKes: row.dealerMarginKes,
          transportMarginKes: row.transportMarginKes,
        },
      });
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "STATION_PRICING_UPDATED",
    entity: "Station",
    entityId: id,
    meta: {
      stationId: id,
      stationName: name,
      before: { name: station.name, fuelPrices: station.fuelPrices },
      after: { name, fuels: rows },
    },
  });

  revalidateSettings();
  return { ok: true };
}

export async function deleteStationAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    return { ok: false, error: "You do not have permission to delete stations." };
  }

  const id = String(formData.get("stationId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing station." };

  const station = await prisma.station.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      _count: {
        select: {
          orders: true,
          fleetTrucks: true,
          stockSaleReports: true,
          pumps: true,
          tanks: true,
        },
      },
    },
  });
  if (!station) return { ok: false, error: "Station not found." };

  if (station._count.orders > 0) {
    return {
      ok: false,
      error: `Cannot delete “${station.name}” — it has ${station._count.orders} order(s) on record.`,
    };
  }
  if (station._count.fleetTrucks > 0) {
    return {
      ok: false,
      error: `Cannot delete “${station.name}” — reassign or remove ${station._count.fleetTrucks} truck(s) first.`,
    };
  }
  if (station._count.stockSaleReports > 0) {
    return {
      ok: false,
      error: `Cannot delete “${station.name}” — it has stock sale reports on record.`,
    };
  }

  // Tanks, pumps, RTT events, fuel prices, and stock-intelligence configs cascade with the station.
  await prisma.station.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "STATION_DELETED",
    entity: "Station",
    entityId: id,
    meta: { stationId: id, stationName: station.name, code: station.code },
  });

  revalidateSettings();
  return { ok: true };
}
