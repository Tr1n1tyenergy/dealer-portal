import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMessagingApi, jsonError } from "@/lib/api-auth";
import { assertParticipant } from "@/lib/messaging/service";
import { triggerConversationEvent } from "@/lib/pusher/server";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const schema = z.object({
  conversationId: z.string().min(1).max(200),
  isTyping: z.boolean(),
});

export async function POST(req: Request) {
  const auth = await requireMessagingApi();
  if ("error" in auth) return auth.error;

  const body = await readJson(req);

  if (body === undefined) return jsonError(INVALID_JSON, 400);

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const ok = await assertParticipant(parsed.data.conversationId, auth.session.user.id);
  if (!ok) return jsonError("Forbidden", 403);

  await triggerConversationEvent(parsed.data.conversationId, "typing", {
    userId: auth.session.user.id,
    isTyping: parsed.data.isTyping,
    name: `${auth.session.user.firstName ?? ""} ${auth.session.user.lastName ?? ""}`.trim(),
  });

  return NextResponse.json({ ok: true });
}
