"use server";

import { requireInternal } from "@/lib/session";

const MANAGED_IN_ODOO = "Trucks and drivers are added in Odoo. This portal reads that list.";

export async function createTruckAction(
  _formData: FormData
): Promise<{ ok: true; truckNumber: string } | { ok: false; error: string }> {
  await requireInternal();
  return { ok: false, error: MANAGED_IN_ODOO };
}

export async function updateTruckAction(
  _formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireInternal();
  return { ok: false, error: MANAGED_IN_ODOO };
}

export async function setTruckStatusAction(
  _formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireInternal();
  return { ok: false, error: MANAGED_IN_ODOO };
}

export async function deleteTruckAction(
  _formData: FormData
): Promise<{ ok: true; mode: "deactivated" | "deleted" } | { ok: false; error: string }> {
  await requireInternal();
  return { ok: false, error: MANAGED_IN_ODOO };
}
