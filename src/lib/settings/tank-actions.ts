"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, ProductCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import {
  parsePumpCount,
  planPumpAdjustment,
  pumpKeyForTank,
  pumpLabelForIndex,
  slotsFromPumps,
} from "@/lib/settings/tank-pumps";

const FUELS = new Set(["PMS", "AGO"]);
const MAX_CAPACITY = 1_000_000;

export type TankFuel = "PMS" | "AGO";

function revalidateSettings() {
  revalidatePath("/intelligence/retail/settings");
  revalidatePath("/intelligence/admin/settings");
  revalidatePath("/intelligence/retail/stock-reporting");
  revalidatePath("/dealer/stock-reporting");
}

async function syncStationEquipmentCounts(tx: Prisma.TransactionClient, stationId: string) {
  const tankCount = await tx.stationTank.count({ where: { stationId, active: true } });
  const pumpCount = await tx.stationPump.count({ where: { stationId, active: true } });
  await tx.station.update({ where: { id: stationId }, data: { tankCount, pumpCount } });
}

async function pumpsHaveHistory(
  pumps: { id: string; stationId: string; pumpKey: string; lastClosingLitres: number; meterInitialized: boolean }[]
) {
  if (pumps.some((pump) => pump.meterInitialized || pump.lastClosingLitres > 0)) return true;
  if (pumps.length === 0) return false;
  const stationId = pumps[0].stationId;
  const [readings, rtt] = await Promise.all([
    prisma.stockSalePumpReading.count({
      where: {
        pumpKey: { in: pumps.map((pump) => pump.pumpKey) },
        report: { stationId },
      },
    }),
    prisma.stationPumpRttEvent.count({ where: { pumpId: { in: pumps.map((pump) => pump.id) } } }),
  ]);
  return readings > 0 || rtt > 0;
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
  const pumps = parsePumpCount(String(formData.get("pumpCount") ?? ""));

  if (!stationId) return { ok: false, error: "Select a station." };
  if (!FUELS.has(product)) return { ok: false, error: "Select PMS or AGO." };
  if (!pumps.ok) return pumps;
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
        await tx.stationPump.createMany({
          data: Array.from({ length: pumps.count }, (_, offset) => {
            const index = offset + 1;
            return {
              stationId,
              tankId: tank.id,
              pumpKey: pumpKeyForTank(next.tankKey, index),
              product: product as ProductCode,
              label: pumpLabelForIndex(index),
              sortOrder: sortOrder * 100 + index,
              lastClosingLitres: 0,
              active: true,
            };
          }),
        });
        await syncStationEquipmentCounts(tx, stationId);
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
          pumpCount: pumps.count,
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
  const pumps = parsePumpCount(String(formData.get("pumpCount") ?? ""));
  const confirmReduce = formData.get("confirmReduce") === "1";
  const requestedDeactivate = [
    ...new Set(
      String(formData.get("deactivatePumpIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  if (!tankId) return { ok: false, error: "Missing tank." };
  if (!pumps.ok) return pumps;
  if (!Number.isFinite(capacityLitres) || capacityLitres <= 0) {
    return { ok: false, error: "Capacity must be a number greater than zero." };
  }
  if (capacityLitres > MAX_CAPACITY) {
    return { ok: false, error: `Capacity cannot exceed ${MAX_CAPACITY.toLocaleString()} litres.` };
  }

  const tank = await prisma.stationTank.findUnique({
    where: { id: tankId },
    include: { pumps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!tank) return { ok: false, error: "Tank not found." };

  const slots = slotsFromPumps(tank.pumps);
  const activeSlots = slots.filter((pump) => pump.active);
  let deactivateIds: string[] = [];
  if (pumps.count < activeSlots.length) {
    const need = activeSlots.length - pumps.count;
    const allowed = new Set(activeSlots.map((pump) => pump.id));
    if (requestedDeactivate.length !== need || requestedDeactivate.some((id) => !allowed.has(id))) {
      return {
        ok: false,
        error: `Select ${need} active ${need === 1 ? "pump" : "pumps"} to deactivate. Their meter history stays on record.`,
      };
    }
    if (!confirmReduce) {
      return { ok: false, error: "Confirm the selected pumps before saving. Their meter history stays on record." };
    }
    deactivateIds = requestedDeactivate;
  }
  const plan =
    pumps.count > activeSlots.length
      ? planPumpAdjustment(slots, pumps.count)
      : { reactivateIds: [] as string[], createIndexes: [] as number[], deactivate: [] };

  const active = status !== "INACTIVE";
  try {
  await prisma.$transaction(async (tx) => {
    await tx.stationTank.update({
      where: { id: tankId },
      data: { capacityLitres, active },
    });
    if (plan.reactivateIds.length) {
      await tx.stationPump.updateMany({
        where: { id: { in: plan.reactivateIds }, tankId },
        data: { active: true },
      });
    }
    if (deactivateIds.length) {
      await tx.stationPump.updateMany({
        where: { id: { in: deactivateIds }, tankId },
        data: { active: false },
      });
    }
    if (plan.createIndexes.length) {
      await tx.stationPump.createMany({
        data: plan.createIndexes.map((index) => ({
          stationId: tank.stationId,
          tankId,
          pumpKey: pumpKeyForTank(tank.tankKey, index),
          product: tank.product,
          label: pumpLabelForIndex(index),
          sortOrder: tank.sortOrder * 100 + index,
          lastClosingLitres: 0,
          active: true,
        })),
      });
    }
    if (!active) {
      await tx.stationPump.updateMany({ where: { tankId }, data: { active: false } });
    }
    await syncStationEquipmentCounts(tx, tank.stationId);
  });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return { ok: false, error: "A pump with that identity already exists at this station. No change was saved." };
    }
    return { ok: false, error: "Could not update the tank. No change was saved." };
  }

  await logActivity({
    actorId: session.user.id,
    action: "TANK_UPDATED",
    entity: "StationTank",
    entityId: tankId,
    meta: {
      label: tank.label,
      stationId: tank.stationId,
      before: {
        capacityLitres: tank.capacityLitres,
        active: tank.active,
        pumpCount: slots.filter((pump) => pump.active).length,
      },
      after: { capacityLitres, active, pumpCount: pumps.count },
      deactivatedPumps: slots.filter((pump) => deactivateIds.includes(pump.id)).map((pump) => pump.pumpKey),
      createdPumps: plan.createIndexes.map((index) => pumpKeyForTank(tank.tankKey, index)),
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

  const tank = await prisma.stationTank.findUnique({
    where: { id: tankId },
    include: { pumps: true },
  });
  if (!tank) return { ok: false, error: "Tank not found." };

  // Tank readings / RTT reference tankKey by string — soft-deactivate to preserve history.
  const usedInReadings = await prisma.stockSaleTankReading.count({
    where: { tankKey: tank.tankKey, report: { stationId: tank.stationId } },
  });
  const usedInRtt = await prisma.stationPumpRttEvent.count({
    where: { stationId: tank.stationId, tankKey: tank.tankKey },
  });
  const pumpHistory = await pumpsHaveHistory(tank.pumps);

  if (usedInReadings > 0 || usedInRtt > 0 || tank.lastClosingLitres > 0 || pumpHistory) {
    await prisma.$transaction(async (tx) => {
      await tx.stationTank.update({ where: { id: tankId }, data: { active: false } });
      await tx.stationPump.updateMany({ where: { tankId }, data: { active: false } });
      await syncStationEquipmentCounts(tx, tank.stationId);
    });
    await logActivity({
      actorId: session.user.id,
      action: "TANK_DEACTIVATED",
      entity: "StationTank",
      entityId: tankId,
      meta: { label: tank.label, stationId: tank.stationId, pumpsDeactivated: tank.pumps.length },
    });
    revalidateSettings();
    return { ok: true, mode: "deactivated" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stationPump.deleteMany({ where: { tankId } });
    await tx.stationTank.delete({ where: { id: tankId } });
    await syncStationEquipmentCounts(tx, tank.stationId);
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
