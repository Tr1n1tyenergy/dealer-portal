import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";
import { setActionDone } from "@/lib/note-taker/action-done";

const bodySchema = z.object({ text: z.string().trim().min(1).max(1000) });

async function handle(req: Request, params: Promise<{ id: string }>, done: boolean) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);
  const result = await setActionDone(auth.session.user.id, (await params).id, parsed.data.text, done);
  return result.ok ? NextResponse.json({ ok: true }) : jsonError(result.message, result.status);
}

/** Tick an action item from your own meeting as done. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, params, true);
}

/** Untick it. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, params, false);
}
