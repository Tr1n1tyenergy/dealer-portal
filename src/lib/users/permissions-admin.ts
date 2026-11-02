import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { adminTargetRefusal, anotherAbleAdmin } from "@/lib/users/admin-rules";
import { canUser, parseOverrides, PERMISSION_KEYS, type PermissionKey, type StaffUser } from "@/lib/permissions";

export type PermissionChange = { key: string; value: "allow" | "deny" | "inherit" };
type Result = { ok: true; permissions: string } | { ok: false; status: 400 | 403 | 404; message: string };

const MAX_CHANGES = 14;

/**
 * Apply Allow / Deny / inherit ticks to a staff member's permissions. Only people with Act on
 * Admin Users may do it, only an Admin may change an Admin, and at least one active Admin must keep
 * Act on Admin Users afterwards.
 */
export async function savePermissions(
  actor: StaffUser & { id: string },
  targetId: string,
  changes: PermissionChange[],
): Promise<Result> {
  if (!canUser(actor, "adminUsers", "act")) return { ok: false, status: 403, message: "Forbidden" };
  if (changes.length > MAX_CHANGES) return { ok: false, status: 400, message: "Too many changes at once." };
  const unknown = changes.find((c) => !PERMISSION_KEYS.includes(c.key as PermissionKey));
  if (unknown) return { ok: false, status: 400, message: `Unknown permission: ${unknown.key}` };

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, status: 404, message: "User not found" };
  if (target.accountType !== "INTERNAL") {
    return { ok: false, status: 400, message: "Permissions apply to staff accounts only." };
  }
  const notAdmin = adminTargetRefusal(actor, target);
  if (notAdmin) return { ok: false, status: 403, message: notAdmin.message };

  const overrides = parseOverrides(target.permissions);
  for (const { key, value } of changes) {
    if (value === "inherit") delete overrides[key as PermissionKey];
    else overrides[key as PermissionKey] = value;
  }
  const next = JSON.stringify(overrides);

  const losesAct = target.role === "SUPER_ADMIN" && target.status === "ACTIVE" &&
    !canUser({ ...target, permissions: next }, "adminUsers", "act");
  if (losesAct && !(await anotherAbleAdmin(targetId))) {
    return { ok: false, status: 400, message: "At least one active Admin must keep Act on Admin Users." };
  }

  await prisma.user.update({ where: { id: targetId }, data: { permissions: next } });
  await logActivity({
    actorId: actor.id,
    action: "USER_PERMISSIONS_CHANGED",
    entity: "User",
    entityId: targetId,
    meta: { before: target.permissions, after: next },
  });
  return { ok: true, permissions: next };
}
