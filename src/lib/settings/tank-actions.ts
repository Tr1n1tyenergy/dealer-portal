"use server";

import { revalidatePath } from "next/cache";
import type { ProductCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";

const FUELS = new Set(["PMS", "AGO"]);
const MAX_CAPACITY = 1_000_000;

export type TankFuel = "PMS" | "AGO";

function revalidateSettings() {
  revalidatePath("/intelligence/retail/settings");
  revalidatePath("/intelligence/admin/settings");
}

async function requireSettingsAct() {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    throw new Error("You do not have permission to manage tanks.");
  }
  return session;
}

/** Next label/key for a fuel at a station — max existing index (incl. inactive) + 1. */
export async function nextTankIdentity(stationId: string, product: TankFuel) {
  const tanks = await prisma.stationTank.findMany({
    where: { stationId, product },
    select: { tankKey: true, label: true },
  });

  let max = 0;
  const keyRe = new RegExp(`^${product}-(\\d+)$`, "i");
  const labelRe = new RegExp(`^${product}\\s+Tank\\s+(\\d+)$`, "i");
  for (const t of tanks) {
    const km = t.tankKey.match(keyRe);
    if (km) max = Math.max(max, Number(km[1]));
    const lm = t.label.match(labelRe);
    if (lm) max = Math.max(max, Number(lm[1]));
  }
  const n = max + 1;
  return {
    n,
    tankKey: `${product}-${n}`,
    label: `${product} Tank ${n}`,
  };
}

export async function previewNextTankName(
  stationId: string,
  product: TankFuel
): Promise<{ ok: true; label: string; tankKey: string } | { ok: false; error: string }> {
  await requireInternal();
  if (!FUELS.has(product)) return { ok: false, error: "Invalid fuel type." };
  const station = await prisma.station.findUnique({ where: { id: stationId }, select: { id: true } });
  if (!station) return { ok: false, error: "Station not found." };
  const next = await nextTankIdentity(stationId, product);
  return { ok: true, label: next.label, tankKey: next.tankKey };
}

export async function createTankAction(
  formData: FormData
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const stationId = String(formData.get("stationId") ?? "").trim();
  const product = String(formData.get("product") ?? "").trim().toUpperCase() as TankFuel;
  const capacityRaw = String(formData.get("capacityLitres") ?? "").replace(/,/g, "").trim();
  const capacityLitres = Number(capacityRaw);

  if (!stationId) return { ok: false, error: "Select a station." };
  if (!FUELS.has(product)) return { ok: false, error: "Select PMS or AGO." };
  if (!Number.isFinite(capacityLitres) || capacityLitres <= 0) {
    return { ok: false, error: "Capacity must be a number greater than zero." };
  }
  if (capacityLitres > MAX_CAPACITY) {
    return { ok: false, error: `Capacity cannot exceed ${MAX_CAPACITY.toLocaleString()} litres.` };
  }

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return { ok: false, error: "Station not found." };

  // Retry once on rare unique collision under concurrency
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const next = await nextTankIdentity(stationId, product);
    const sortOrder = await prisma.stationTank.count({ where: { stationId } });
    try {
      const created = await prisma.$transaction(async (tx) => {
        const tank = await tx.stationTank.create({
          data: {
            stationId,
            tankKey: next.tankKey,
            product: product as ProductCode,
            label: next.label,
            sortOrder,
            capacityLitres,
            lastClosingLitres: 0,
            active: true,
          },
        });
        const activeCount = await tx.stationTank.count({ where: { stationId, active: true } });
        await tx.station.update({ where: { id: stationId }, data: { tankCount: activeCount } });
        return tank;
      });
      await logActivity({
        actorId: session.user.id,
        action: "TANK_CREATED",
        entity: "StationTank",
        entityId: created.id,
        meta: {
          label: next.label,
          tankKey: next.tankKey,
          product,
          capacityLitres,
          stationId,
          stationName: station.name,
        },
      });
      revalidateSettings();
      return { ok: true, label: next.label };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002" &&
        attempt === 0
      ) {
        continue;
      }
      return { ok: false, error: "Could not create tank. Try again." };
    }
  }
  return { ok: false, error: "Could not create tank. Try again." };
}

export async function updateTankAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const tankId = String(formData.get("tankId") ?? "").trim();
  const capacityRaw = String(formData.get("capacityLitres") ?? "").replace(/,/g, "").trim();
  const capacityLitres = Number(capacityRaw);
  const status = String(formData.get("status") ?? "ACTIVE").toUpperCase();

  if (!tankId) return { ok: false, error: "Missing tank." };
  if (!Number.isFinite(capacityLitres) || capacityLitres <= 0) {
    return { ok: false, error: "Capacity must be a number greater than zero." };
  }
  if (capacityLitres > MAX_CAPACITY) {
    return { ok: false, error: `Capacity cannot exceed ${MAX_CAPACITY.toLocaleString()} litres.` };
  }

  const tank = await prisma.stationTank.findUnique({ where: { id: tankId } });
  if (!tank) return { ok: false, error: "Tank not found." };

  const active = status !== "INACTIVE";
  await prisma.$transaction(async (tx) => {
    await tx.stationTank.update({
      where: { id: tankId },
      data: { capacityLitres, active },
    });
    const activeCount = await tx.stationTank.count({ where: { stationId: tank.stationId, active: true } });
    await tx.station.update({ where: { id: tank.stationId }, data: { tankCount: activeCount } });
  });

  await logActivity({
    actorId: session.user.id,
    action: "TANK_UPDATED",
    entity: "StationTank",
    entityId: tankId,
    meta: {
      label: tank.label,
      stationId: tank.stationId,
      before: { capacityLitres: tank.capacityLitres, active: tank.active },
      after: { capacityLitres, active },
    },
  });

  revalidateSettings();
  return { ok: true };
}

export async function deleteTankAction(
  formData: FormData
): Promise<{ ok: true; mode: "deactivated" | "deleted" } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const tankId = String(formData.get("tankId") ?? "").trim();
  if (!tankId) return { ok: false, error: "Missing tank." };

  const tank = await prisma.stationTank.findUnique({ where: { id: tankId } });
  if (!tank) return { ok: false, error: "Tank not found." };

  // Tank readings / RTT reference tankKey by string — soft-deactivate to preserve history.
  const usedInReadings = await prisma.stockSaleTankReading.count({
    where: { tankKey: tank.tankKey, report: { stationId: tank.stationId } },
  });
  const usedInRtt = await prisma.stationPumpRttEvent.count({
    where: { stationId: tank.stationId, tankKey: tank.tankKey },
  });

  if (usedInReadings > 0 || usedInRtt > 0 || tank.lastClosingLitres > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.stationTank.update({ where: { id: tankId }, data: { active: false } });
      const activeCount = await tx.stationTank.count({ where: { stationId: tank.stationId, active: true } });
      await tx.station.update({ where: { id: tank.stationId }, data: { tankCount: activeCount } });
    });
    await logActivity({
      actorId: session.user.id,
      action: "TANK_DEACTIVATED",
      entity: "StationTank",
      entityId: tankId,
      meta: { label: tank.label, stationId: tank.stationId },
    });
    revalidateSettings();
    return { ok: true, mode: "deactivated" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stationTank.delete({ where: { id: tankId } });
    const activeCount = await tx.stationTank.count({ where: { stationId: tank.stationId, active: true } });
    await tx.station.update({ where: { id: tank.stationId }, data: { tankCount: activeCount } });
  });
  await logActivity({
    actorId: session.user.id,
    action: "TANK_DELETED",
    entity: "StationTank",
    entityId: tankId,
    meta: { label: tank.label, stationId: tank.stationId },
  });
  revalidateSettings();
  return { ok: true, mode: "deleted" };
}
