import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { decideAccessRequest } from "@/lib/users/access-requests";

const bodySchema = z.object({ status: z.enum(["GRANTED", "DECLINED"]) });

/** An Admin marks a pending request granted (after saving the ticks) or declined. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);
  const result = await decideAccessRequest(auth.session.user, (await params).id, parsed.data.status);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(result.message, result.status);
}
