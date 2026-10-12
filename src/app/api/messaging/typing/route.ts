import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionApi, jsonError } from "@/lib/api-auth";
import { assertParticipant } from "@/lib/messaging/service";
import { triggerConversationEvent } from "@/lib/pusher/server";

const schema = z.object({
  conversationId: z.string().min(1),
  isTyping: z.boolean(),
});

export async function POST(req: Request) {
  const auth = await requireSessionApi();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await req.json());
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
