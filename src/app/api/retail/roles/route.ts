import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { createRoleTemplate, listRoleCatalog } from "@/lib/users/staff-role-templates";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  permissions: z
    .array(z.string())
    .max(40)
    .optional()
    .transform((keys) => (keys ?? []).filter((k) => PERMISSION_KEYS.includes(k as (typeof PERMISSION_KEYS)[number]))),
});

export async function GET() {
  const auth = await requirePermissionApi("retailUsers", "view");
  if ("error" in auth) return auth.error;

  const roles = await listRoleCatalog();
  return NextResponse.json({ roles });
}

export async function POST(req: Request) {
  const auth = await requirePermissionApi("retailUsers", "act");
  if ("error" in auth) return auth.error;

  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const created = await createRoleTemplate(
    { id: auth.session.user.id },
    {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions as never,
    },
  );
  if (!created.ok) return jsonError(created.message, created.status);
  return NextResponse.json({ role: created.role }, { status: 201 });
}
