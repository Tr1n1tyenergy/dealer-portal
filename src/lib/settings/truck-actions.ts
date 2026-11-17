"use server";

import { revalidatePath } from "next/cache";
import type { FleetTruckStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import {
  litresToMilli,
  MAX_COMPARTMENTS,
  MIN_COMPARTMENTS,
  resolveCompartmentCapacities,
} from "@/lib/settings/truck-compartments";

const MAX_CAPACITY = 200_000;
const STATUSES = new Set(["ACTIVE", "MAINTENANCE", "INACTIVE"]);

function revalidateSettings() {
  revalidatePath("/intelligence/retail/settings");
  revalidatePath("/intelligence/admin/settings");
}

async function requireSettingsAct() {
  const session = await requireInternal();
  if (!canUser(session.user, "settings", "act")) {
    throw new Error("You do not have permission to manage trucks.");
  }
  return session;
}

/** Normalize Kenya-style plates: uppercase, single spaces. */
function normalizeRegistration(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/[\s-]+/g, " ")
    .trim();
}

function parseCapacityLitres(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s*L\b.*/i, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function parseCompartmentJson(raw: string): number[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: number[] = [];
    for (const item of parsed) {
      const n = typeof item === "number" ? item : Number(item);
      if (!Number.isFinite(n)) return null;
      out.push(Math.round(n * 1000) / 1000);
    }
    return out;
  } catch {
    return null;
  }
}

function normalizeCompanyName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Find or create a transport company from a typed name. */
async function resolveTransportCompanyByName(
  rawName: string
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const name = normalizeCompanyName(rawName);
  if (!name || name.length < 2) {
    return { ok: false, error: "Enter a transport company name." };
  }
  if (name.length > 120) {
    return { ok: false, error: "Transport company name is too long." };
  }

  const existing = await prisma.transportCompany.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true, active: true },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.transportCompany.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }
    return { ok: true, id: existing.id, name: existing.name };
  }

  const created = await prisma.transportCompany.create({
    data: { name, active: true },
    select: { id: true, name: true },
  });
  return { ok: true, id: created.id, name: created.name };
}

function validateCompartmentPayload(
  totalLitres: number,
  capacities: number[]
): { ok: true; capacities: number[] } | { ok: false; error: string } {
  const n = capacities.length;
  if (n < MIN_COMPARTMENTS || n > MAX_COMPARTMENTS) {
    return { ok: false, error: `Compartment count must be between ${MIN_COMPARTMENTS} and ${MAX_COMPARTMENTS}.` };
  }
  for (let i = 0; i < n; i += 1) {
    if (!(capacities[i]! > 0)) {
      return { ok: false, error: `Compartment ${i + 1} must be greater than zero.` };
    }
  }
  const editable = capacities.slice(0, -1);
  const resolved = resolveCompartmentCapacities(totalLitres, n, editable);
  if (!resolved.valid) {
    return { ok: false, error: resolved.error ?? "Invalid compartment allocation." };
  }
  const expectedMilli = resolved.capacities.map(litresToMilli);
  const actualMilli = capacities.map(litresToMilli);
  for (let i = 0; i < n; i += 1) {
    if (expectedMilli[i] !== actualMilli[i]) {
      return {
        ok: false,
        error: "Compartment capacities must sum exactly to truck capacity (final compartment is calculated).",
      };
    }
  }
  return { ok: true, capacities: resolved.capacities };
}

export async function nextTruckNumber(): Promise<string> {
  const trucks = await prisma.fleetTruck.findMany({ select: { truckNumber: true } });
  let max = 0;
  const re = /^TRK-(\d+)$/i;
  for (const t of trucks) {
    const m = t.truckNumber.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TRK-${String(max + 1).padStart(3, "0")}`;
}

export async function previewNextTruckNumber(): Promise<
  { ok: true; truckNumber: string } | { ok: false; error: string }
> {
  await requireInternal();
  const truckNumber = await nextTruckNumber();
  return { ok: true, truckNumber };
}

export async function createTruckAction(
  formData: FormData
): Promise<{ ok: true; truckNumber: string } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const transportCompanyName = String(formData.get("transportCompanyName") ?? "");
  const registrationNumber = normalizeRegistration(String(formData.get("registrationNumber") ?? ""));
  const capacityLitres = parseCapacityLitres(String(formData.get("capacityLitres") ?? ""));
  const driverName = String(formData.get("driverName") ?? "").trim();
  const driverId = String(formData.get("driverId") ?? "").trim();
  const compartmentsRaw = String(formData.get("compartments") ?? "").trim();
  const capacities = parseCompartmentJson(compartmentsRaw);

  if (!registrationNumber || registrationNumber.length < 5) {
    return { ok: false, error: "Enter a valid registration number." };
  }
  if (capacityLitres == null || capacityLitres <= 0) {
    return { ok: false, error: "Capacity must be a number greater than zero." };
  }
  if (capacityLitres > MAX_CAPACITY) {
    return { ok: false, error: `Capacity cannot exceed ${MAX_CAPACITY.toLocaleString()} litres.` };
  }
  if (!driverName) return { ok: false, error: "Enter the driver name." };
  if (!driverId) return { ok: false, error: "Enter the driver ID." };
  if (!capacities) return { ok: false, error: "Provide a valid compartment configuration." };

  const company = await resolveTransportCompanyByName(transportCompanyName);
  if (!company.ok) return company;

  const compartmentCheck = validateCompartmentPayload(capacityLitres, capacities);
  if (!compartmentCheck.ok) return compartmentCheck;

  const dupReg = await prisma.fleetTruck.findUnique({ where: { registrationNumber } });
  if (dupReg) return { ok: false, error: "A truck with this registration already exists." };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const truckNumber = await nextTruckNumber();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const truck = await tx.fleetTruck.create({
          data: {
            truckNumber,
            registrationNumber,
            transportCompanyId: company.id,
            capacityLitres,
            status: "ACTIVE",
            driverName,
            driverId,
            compartments: {
              create: compartmentCheck.capacities.map((capacityLitresValue, index) => ({
                compartmentNumber: index + 1,
                capacityLitres: capacityLitresValue,
              })),
            },
          },
        });
        return truck;
      });

      await logActivity({
        actorId: session.user.id,
        action: "TRUCK_CREATED",
        entity: "FleetTruck",
        entityId: created.id,
        meta: {
          truckNumber,
          registrationNumber,
          capacityLitres,
          transportCompanyId: company.id,
          transportCompanyName: company.name,
          driverName,
          driverId,
          compartments: compartmentCheck.capacities,
        },
      });
      revalidateSettings();
      return { ok: true, truckNumber };
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
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
        return { ok: false, error: "Truck number or registration conflict. Try again." };
      }
      return { ok: false, error: "Could not create truck. Try again." };
    }
  }
  return { ok: false, error: "Could not create truck. Try again." };
}

export async function updateTruckAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const truckId = String(formData.get("truckId") ?? "").trim();
  const transportCompanyName = String(formData.get("transportCompanyName") ?? "");
  const registrationNumber = normalizeRegistration(String(formData.get("registrationNumber") ?? ""));
  const capacityLitres = parseCapacityLitres(String(formData.get("capacityLitres") ?? ""));
  const driverName = String(formData.get("driverName") ?? "").trim();
  const driverId = String(formData.get("driverId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "ACTIVE").toUpperCase();
  const compartmentsRaw = String(formData.get("compartments") ?? "").trim();
  const capacities = parseCompartmentJson(compartmentsRaw);

  if (!truckId) return { ok: false, error: "Missing truck." };
  if (!registrationNumber || registrationNumber.length < 5) {
    return { ok: false, error: "Enter a valid registration number." };
  }
  if (capacityLitres == null || capacityLitres <= 0) {
    return { ok: false, error: "Capacity must be a number greater than zero." };
  }
  if (capacityLitres > MAX_CAPACITY) {
    return { ok: false, error: `Capacity cannot exceed ${MAX_CAPACITY.toLocaleString()} litres.` };
  }
  if (!driverName) return { ok: false, error: "Enter the driver name." };
  if (!driverId) return { ok: false, error: "Enter the driver ID." };
  if (!STATUSES.has(statusRaw)) return { ok: false, error: "Invalid status." };
  if (!capacities) return { ok: false, error: "Provide a valid compartment configuration." };

  const existing = await prisma.fleetTruck.findUnique({
    where: { id: truckId },
    include: { compartments: { orderBy: { compartmentNumber: "asc" } } },
  });
  if (!existing) return { ok: false, error: "Truck not found." };

  const company = await resolveTransportCompanyByName(transportCompanyName);
  if (!company.ok) return company;

  const compartmentCheck = validateCompartmentPayload(capacityLitres, capacities);
  if (!compartmentCheck.ok) return compartmentCheck;

  const dupReg = await prisma.fleetTruck.findFirst({
    where: { registrationNumber, NOT: { id: truckId } },
    select: { id: true },
  });
  if (dupReg) return { ok: false, error: "A truck with this registration already exists." };

  await prisma.$transaction(async (tx) => {
    await tx.fleetTruck.update({
      where: { id: truckId },
      data: {
        transportCompanyId: company.id,
        registrationNumber,
        capacityLitres,
        status: statusRaw as FleetTruckStatus,
        driverName,
        driverId,
      },
    });
    await tx.fleetTruckCompartment.deleteMany({ where: { truckId } });
    await tx.fleetTruckCompartment.createMany({
      data: compartmentCheck.capacities.map((capacityLitresValue, index) => ({
        truckId,
        compartmentNumber: index + 1,
        capacityLitres: capacityLitresValue,
      })),
    });
  });

  await logActivity({
    actorId: session.user.id,
    action: "TRUCK_UPDATED",
    entity: "FleetTruck",
    entityId: truckId,
    meta: {
      truckNumber: existing.truckNumber,
      transportCompanyId: company.id,
      before: {
        registrationNumber: existing.registrationNumber,
        capacityLitres: existing.capacityLitres,
        status: existing.status,
        driverName: existing.driverName,
        driverId: existing.driverId,
        compartments: existing.compartments.map((c) => c.capacityLitres),
      },
      after: {
        registrationNumber,
        capacityLitres,
        status: statusRaw,
        driverName,
        driverId,
        compartments: compartmentCheck.capacities,
      },
    },
  });

  revalidateSettings();
  return { ok: true };
}

export async function setTruckStatusAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const truckId = String(formData.get("truckId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").toUpperCase();
  if (!truckId) return { ok: false, error: "Missing truck." };
  if (!STATUSES.has(statusRaw)) return { ok: false, error: "Invalid status." };

  const existing = await prisma.fleetTruck.findUnique({ where: { id: truckId } });
  if (!existing) return { ok: false, error: "Truck not found." };

  await prisma.fleetTruck.update({
    where: { id: truckId },
    data: { status: statusRaw as FleetTruckStatus },
  });
  await logActivity({
    actorId: session.user.id,
    action: "TRUCK_STATUS_CHANGED",
    entity: "FleetTruck",
    entityId: truckId,
    meta: {
      truckNumber: existing.truckNumber,
      stationId: existing.stationId,
      status: statusRaw,
      before: existing.status,
      after: statusRaw,
    },
  });
  revalidateSettings();
  return { ok: true };
}

export async function deleteTruckAction(
  formData: FormData
): Promise<{ ok: true; mode: "deactivated" | "deleted" } | { ok: false; error: string }> {
  let session;
  try {
    session = await requireSettingsAct();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
  }

  const truckId = String(formData.get("truckId") ?? "").trim();
  if (!truckId) return { ok: false, error: "Missing truck." };

  const truck = await prisma.fleetTruck.findUnique({ where: { id: truckId } });
  if (!truck) return { ok: false, error: "Truck not found." };

  const usedInOrders = await prisma.dealerOrder.count({
    where: { truckRegistration: { equals: truck.registrationNumber, mode: "insensitive" } },
  });

  if (usedInOrders > 0) {
    await prisma.fleetTruck.update({
      where: { id: truckId },
      data: { status: "INACTIVE" },
    });
    await logActivity({
      actorId: session.user.id,
      action: "TRUCK_DEACTIVATED",
      entity: "FleetTruck",
      entityId: truckId,
      meta: { truckNumber: truck.truckNumber, stationId: truck.stationId },
    });
    revalidateSettings();
    return { ok: true, mode: "deactivated" };
  }

  await prisma.fleetTruck.delete({ where: { id: truckId } });
  await logActivity({
    actorId: session.user.id,
    action: "TRUCK_DELETED",
    entity: "FleetTruck",
    entityId: truckId,
    meta: { truckNumber: truck.truckNumber, stationId: truck.stationId },
  });
  revalidateSettings();
  return { ok: true, mode: "deleted" };
}
