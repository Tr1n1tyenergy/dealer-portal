import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  codeRoleDefaultKeys,
  migratePermissionKeys,
  normalizePermissionKeys,
  overridesForDesiredMatrix,
  type PermissionKey,
} from "@/lib/permissions";
import { STAFF_ROLES, type StaffRole } from "@/lib/access";

const settingKey = (role: StaffRole) => `staff.roleDefaults.${role}`;

function parseStoredKeys(raw: string | null | undefined): PermissionKey[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return migratePermissionKeys(parsed.filter((k): k is string => typeof k === "string"));
}

/** Effective system-role matrix: SystemSetting override, else built-in defaults. */
export async function getSystemRolePermissionKeys(role: StaffRole): Promise<PermissionKey[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: settingKey(role) } });
  const stored = parseStoredKeys(row?.value);
  if (stored) return stored;
  return codeRoleDefaultKeys(role);
}

export async function updateSystemRolePermissions(
  actor: { id: string },
  role: StaffRole,
  permissions: PermissionKey[],
): Promise<{ ok: true; permissions: PermissionKey[] } | { ok: false; status: 400; message: string }> {
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 400, message: "Unknown system role." };
  }

  const normalized = normalizePermissionKeys(permissions);

  if (role === "SUPER_ADMIN") {
    const required: PermissionKey[] = [
      "accessRetail.view",
      "accessRetail.act",
      "adminUsers.view",
      "adminUsers.act",
      "retailUsers.view",
      "retailUsers.act",
    ];
    for (const key of required) {
      if (!normalized.includes(key)) {
        return {
          ok: false,
          status: 400,
          message: "Admin role must keep Retail module access plus Admin and Users read/write.",
        };
      }
    }
  }

  const overrides = overridesForDesiredMatrix(role, normalized);
  const overridesJson = JSON.stringify(overrides);

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: settingKey(role) },
      create: { key: settingKey(role), value: JSON.stringify(normalized) },
      update: { value: JSON.stringify(normalized) },
    });

    await tx.user.updateMany({
      where: { accountType: "INTERNAL", role },
      data: { permissions: overridesJson },
    });
  });

  await logActivity({
    actorId: actor.id,
    action: "STAFF_SYSTEM_ROLE_PERMISSIONS_UPDATED",
    entity: "SystemSetting",
    entityId: settingKey(role),
    meta: { role, permissionCount: normalized.length },
  });

  return { ok: true, permissions: normalized };
}
