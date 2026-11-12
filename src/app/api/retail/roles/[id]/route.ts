import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { PERMISSION_KEYS } from "@/lib/permissions";
import {
  deleteRoleTemplate,
  duplicateRoleTemplate,
  updateRoleTemplate,
} from "@/lib/users/staff-role-templates";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: z
    .array(z.string())
    .max(40)
    .optional()
    .transform((keys) =>
      keys === undefined
        ? undefined
        : keys.filter((k) => PERMISSION_KEYS.includes(k as (typeof PERMISSION_KEYS)[number])),
    ),
  duplicate: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requirePermissionApi("retailUsers", "act");
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  if (parsed.data.duplicate) {
    const dup = await duplicateRoleTemplate({ id: auth.session.user.id }, id);
    if (!dup.ok) return jsonError(dup.message, dup.status);
    return NextResponse.json({ role: dup.role }, { status: 201 });
  }

  if (id.startsWith("system:")) {
    if (parsed.data.permissions === undefined) {
      return jsonError("System roles only support permission updates (or Duplicate).", 400);
    }
    if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
      return jsonError("System role name and description cannot be edited.", 400);
    }
  }

  const updated = await updateRoleTemplate(
    { id: auth.session.user.id },
    id,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions as never,
    },
  );
  if (!updated.ok) return jsonError(updated.message, updated.status);
  return NextResponse.json({ role: updated.role });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requirePermissionApi("retailUsers", "act");
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const deleted = await deleteRoleTemplate({ id: auth.session.user.id }, id);
  if (!deleted.ok) return jsonError(deleted.message, deleted.status);
  return NextResponse.json({ ok: true });
}
