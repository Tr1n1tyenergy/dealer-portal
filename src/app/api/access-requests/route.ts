import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { createAccessRequest, NOTE_MAX } from "@/lib/users/access-requests";

const bodySchema = z.object({ modules: z.array(z.string()).max(20), note: z.string().max(NOTE_MAX).optional() });

/** "Ask an Admin": a staff member requests more areas of the portal. */
export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);
  const result = await createAccessRequest(auth.session.user, parsed.data.modules, parsed.data.note);
  return result.ok ? NextResponse.json({ id: result.id }, { status: 201 }) : jsonError(result.message, result.status);
}
