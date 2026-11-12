import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  migratePermissionKeys,
  normalizePermissionKeys,
  overridesForDesiredMatrix,
  PERMISSION_KEYS,
  PERMISSION_MODULES,
  type PermissionKey,
} from "@/lib/permissions";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/access";
import { getSystemRolePermissionKeys, updateSystemRolePermissions } from "@/lib/users/system-role-defaults";

export type RoleListItem = {
  id: string;
  kind: "system" | "template";
  name: string;
  description: string;
  permissions: PermissionKey[];
  moduleCount: number;
  baseRole: StaffRole;
  systemRole?: StaffRole;
  isSystem: boolean;
  status: "active";
};

function parsePermissionKeys(raw: string | null | undefined): PermissionKey[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return migratePermissionKeys(parsed.filter((k): k is string => typeof k === "string"));
}

export { normalizePermissionKeys };

export function keysToAllowOverrides(keys: PermissionKey[]): string {
  const normalized = normalizePermissionKeys(keys);
  const obj: Partial<Record<PermissionKey, "allow">> = {};
  for (const key of normalized) obj[key] = "allow";
  return JSON.stringify(obj);
}

function moduleCountFor(keys: PermissionKey[]): number {
  return PERMISSION_MODULES.filter((m) =>
    m.levels.some((level) => keys.includes(`${m.key}.${level}` as PermissionKey)),
  ).length;
}

function systemRoleDescription(role: StaffRole): string {
  if (role === "SUPER_ADMIN") return "Full platform access for Trinity administrators.";
  if (role === "SALES_PERSON_EXECUTIVE") {
    return "Executive access to analytics, orders, messaging, and support.";
  }
  return "Standard staff member with role-default module access.";
}

export async function listRoleCatalog(): Promise<RoleListItem[]> {
  const system: RoleListItem[] = [];
  for (const role of STAFF_ROLES) {
    const permissions = await getSystemRolePermissionKeys(role);
    system.push({
      id: `system:${role}`,
      kind: "system" as const,
      name: ROLE_LABELS[role] ?? role,
      description: systemRoleDescription(role),
      permissions,
      moduleCount: moduleCountFor(permissions),
      baseRole: role,
      systemRole: role,
      isSystem: true,
      status: "active" as const,
    });
  }

  const templates = await prisma.staffRoleTemplate.findMany({ orderBy: { name: "asc" } });
  const custom: RoleListItem[] = templates.map((t) => {
    const permissions = parsePermissionKeys(t.permissions);
    return {
      id: t.id,
      kind: "template" as const,
      name: t.name,
      description: t.description?.trim() || "Custom staff role template.",
      permissions,
      moduleCount: moduleCountFor(permissions),
      baseRole: t.baseRole as StaffRole,
      isSystem: false,
      status: "active" as const,
    };
  });

  return [...system, ...custom];
}

type Actor = { id: string };

export async function createRoleTemplate(
  actor: Actor,
  input: { name: string; description?: string | null; permissions?: PermissionKey[] },
): Promise<{ ok: true; role: RoleListItem } | { ok: false; status: 400 | 409; message: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, status: 400, message: "Role name is required." };
  if (name.length > 80) return { ok: false, status: 400, message: "Role name is too long." };

  const reserved = STAFF_ROLES.some(
    (r) => (ROLE_LABELS[r] ?? r).toLowerCase() === name.toLowerCase() || r.toLowerCase() === name.toLowerCase(),
  );
  if (reserved) {
    return { ok: false, status: 400, message: "That name is reserved for a system role." };
  }

  const permissions = normalizePermissionKeys(input.permissions ?? []);
  const created = await prisma.staffRoleTemplate
    .create({
      data: {
        name,
        description: input.description?.trim() || null,
        permissions: JSON.stringify(permissions),
        baseRole: "STANDARD_USER",
        createdById: actor.id,
      },
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002") return null;
      throw error;
    });
  if (!created) return { ok: false, status: 409, message: "A role with this name already exists." };

  await logActivity({
    actorId: actor.id,
    action: "STAFF_ROLE_TEMPLATE_CREATED",
    entity: "StaffRoleTemplate",
    entityId: created.id,
    meta: { name: created.name },
  });

  const catalog = await listRoleCatalog();
  const role = catalog.find((r) => r.id === created.id);
  if (!role) return { ok: false, status: 400, message: "Role created but could not be loaded." };
  return { ok: true, role };
}

export async function updateSystemRole(
  actor: Actor,
  systemId: string,
  permissions: PermissionKey[],
): Promise<{ ok: true; role: RoleListItem } | { ok: false; status: 400 | 404; message: string }> {
  if (!systemId.startsWith("system:")) {
    return { ok: false, status: 400, message: "Not a system role." };
  }
  const role = systemId.slice("system:".length) as StaffRole;
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 404, message: "System role not found." };
  }
  const updated = await updateSystemRolePermissions(actor, role, permissions);
  if (!updated.ok) return updated;

  const catalog = await listRoleCatalog();
  const item = catalog.find((r) => r.id === systemId);
  if (!item) return { ok: false, status: 400, message: "Role updated but could not be loaded." };
  return { ok: true, role: item };
}

export async function updateRoleTemplate(
  actor: Actor,
  id: string,
  input: { name?: string; description?: string | null; permissions?: PermissionKey[] },
): Promise<{ ok: true; role: RoleListItem } | { ok: false; status: 400 | 404 | 409; message: string }> {
  if (id.startsWith("system:")) {
    if (input.permissions === undefined) {
      return { ok: false, status: 400, message: "System roles only support permission updates." };
    }
    return updateSystemRole(actor, id, input.permissions);
  }

  const existing = await prisma.staffRoleTemplate.findUnique({ where: { id } });
  if (!existing) return { ok: false, status: 404, message: "Role not found." };

  const name = input.name?.trim();
  if (name !== undefined) {
    if (!name) return { ok: false, status: 400, message: "Role name is required." };
    const reserved = STAFF_ROLES.some(
      (r) => (ROLE_LABELS[r] ?? r).toLowerCase() === name.toLowerCase(),
    );
    if (reserved) return { ok: false, status: 400, message: "That name is reserved for a system role." };
  }

  const updated = await prisma.staffRoleTemplate
    .update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        permissions:
          input.permissions === undefined
            ? undefined
            : JSON.stringify(normalizePermissionKeys(input.permissions)),
      },
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002") return null;
      throw error;
    });
  if (!updated) return { ok: false, status: 409, message: "A role with this name already exists." };

  await logActivity({
    actorId: actor.id,
    action: "STAFF_ROLE_TEMPLATE_UPDATED",
    entity: "StaffRoleTemplate",
    entityId: id,
    meta: { name: updated.name },
  });

  const catalog = await listRoleCatalog();
  const role = catalog.find((r) => r.id === id);
  if (!role) return { ok: false, status: 400, message: "Role updated but could not be loaded." };
  return { ok: true, role };
}

export async function duplicateRoleTemplate(
  actor: Actor,
  id: string,
): Promise<{ ok: true; role: RoleListItem } | { ok: false; status: 404 | 400 | 409; message: string }> {
  const catalog = await listRoleCatalog();
  const source = catalog.find((r) => r.id === id);
  if (!source) return { ok: false, status: 404, message: "Role not found." };

  let name = `${source.name} copy`;
  const names = new Set(catalog.map((r) => r.name.toLowerCase()));
  let n = 2;
  while (names.has(name.toLowerCase())) {
    name = `${source.name} copy ${n}`;
    n += 1;
  }

  return createRoleTemplate(actor, {
    name,
    description: source.description,
    permissions: source.permissions,
  });
}

export async function deleteRoleTemplate(
  actor: Actor,
  id: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 404; message: string }> {
  if (id.startsWith("system:")) {
    return { ok: false, status: 400, message: "System roles cannot be deleted." };
  }
  const existing = await prisma.staffRoleTemplate.findUnique({ where: { id } });
  if (!existing) return { ok: false, status: 404, message: "Role not found." };

  await prisma.staffRoleTemplate.delete({ where: { id } });
  await logActivity({
    actorId: actor.id,
    action: "STAFF_ROLE_TEMPLATE_DELETED",
    entity: "StaffRoleTemplate",
    entityId: id,
    meta: { name: existing.name },
  });
  return { ok: true };
}

export async function resolveInviteRole(input: {
  role?: string;
  roleTemplateId?: string | null;
}): Promise<
  | { ok: true; role: StaffRole; permissions: string; templateName?: string }
  | { ok: false; status: 400; message: string }
> {
  if (input.roleTemplateId) {
    const template = await prisma.staffRoleTemplate.findUnique({ where: { id: input.roleTemplateId } });
    if (!template) return { ok: false, status: 400, message: "Unknown role template." };
    const keys = parsePermissionKeys(template.permissions);
    return {
      ok: true,
      role: template.baseRole as StaffRole,
      permissions: keysToAllowOverrides(keys),
      templateName: template.name,
    };
  }

  const role = (input.role ?? "STANDARD_USER") as StaffRole;
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 400, message: "Invalid staff role." };
  }
  const keys = await getSystemRolePermissionKeys(role);
  return {
    ok: true,
    role,
    permissions: JSON.stringify(overridesForDesiredMatrix(role, keys)),
  };
}
