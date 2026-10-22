import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { savePermissions } from "@/lib/users/permissions-admin";

const schema = z.object({
  changes: z.array(z.object({ key: z.string().max(40), value: z.enum(["allow", "deny", "inherit"]) })).max(14),
});

/** Set a staff member's Allow / Deny ticks (Admin → Users → Permissions). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionApi("adminUsers", "act");
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const { id } = await params;
  const result = await savePermissions(auth.session.user, id, parsed.data.changes);
  if (!result.ok) return jsonError(result.message, result.status);
  return NextResponse.json({ permissions: result.permissions });
}
