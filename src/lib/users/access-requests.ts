import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canUser, PERMISSION_MODULES, type PermissionModule, type StaffUser } from "@/lib/permissions";

type Actor = StaffUser & { id: string };
type Result = { ok: true; id: string } | { ok: false; status: 400 | 403 | 404 | 409; message: string };

export const NOTE_MAX = 500;
const MODULE_KEYS = PERMISSION_MODULES.map((m) => m.key as string);

/** A staff member asks an Admin for more of the portal. One pending request per person. */
export async function createAccessRequest(actor: Actor, modules: string[], note?: string | null): Promise<Result> {
  if (actor.accountType !== "INTERNAL") return { ok: false, status: 403, message: "Forbidden" };
  const wanted = [...new Set(modules)];
  if (wanted.length === 0) return { ok: false, status: 400, message: "Pick at least one area." };
  const unknown = wanted.find((m) => !MODULE_KEYS.includes(m));
  if (unknown) return { ok: false, status: 400, message: `Unknown area: ${unknown}` };
  const text = note?.trim().slice(0, NOTE_MAX) || null;
  // shortcut: check-then-create can let two simultaneous clicks both through; upgrade to a partial unique index if that ever matters
  if (await prisma.accessRequest.findFirst({ where: { requesterId: actor.id, status: "PENDING" } })) {
    return { ok: false, status: 409, message: "You already have a request waiting for an Admin." };
  }
  const row = await prisma.accessRequest.create({ data: { requesterId: actor.id, modules: JSON.stringify(wanted), note: text } });
  await logActivity({ actorId: actor.id, action: "ACCESS_REQUESTED", entity: "AccessRequest", entityId: row.id, meta: { modules: wanted } });
  return { ok: true, id: row.id };
}

/** An Admin (Act on Admin users) grants or declines a pending request. Granting the ticks themselves is savePermissions. */
export async function decideAccessRequest(actor: Actor, id: string, status: "GRANTED" | "DECLINED"): Promise<Result> {
  if (!canUser(actor, "adminUsers", "act")) return { ok: false, status: 403, message: "Forbidden" };
  const { count } = await prisma.accessRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status, decidedById: actor.id, decidedAt: new Date() },
  });
  if (count === 0) {
    const exists = await prisma.accessRequest.findUnique({ where: { id }, select: { id: true } });
    return exists ? { ok: false, status: 409, message: "This request was already decided." } : { ok: false, status: 404, message: "Request not found" };
  }
  await logActivity({ actorId: actor.id, action: status === "GRANTED" ? "ACCESS_GRANTED" : "ACCESS_DECLINED", entity: "AccessRequest", entityId: id });
  return { ok: true, id };
}

/** Pending requests for the Admin lists, oldest first. */
export async function pendingAccessRequests() {
  const rows = await prisma.accessRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { requester: { select: { id: true, firstName: true, lastName: true, role: true, permissions: true, department: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    modules: (JSON.parse(r.modules) as string[]).filter((m): m is PermissionModule => MODULE_KEYS.includes(m)),
    requester: r.requester,
  }));
}
