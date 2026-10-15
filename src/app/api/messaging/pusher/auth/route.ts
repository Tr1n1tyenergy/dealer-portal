import { NextResponse } from "next/server";
import { requireMessagingApi, jsonError } from "@/lib/api-auth";
import { getPusherServer, pusherConfigured } from "@/lib/pusher/server";
import { assertParticipant } from "@/lib/messaging/service";

export async function POST(req: Request) {
  const auth = await requireMessagingApi();
  if ("error" in auth) return auth.error;

  if (!pusherConfigured()) {
    return jsonError("Realtime is not configured (Pusher).", 503);
  }

  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");
  if (!socketId || !channel) return jsonError("Missing socket_id or channel_name", 400);

  const pusher = getPusherServer();
  if (!pusher) return jsonError("Pusher unavailable", 503);

  const userId = auth.session.user.id;

  if (channel.startsWith("private-conversation-")) {
    const conversationId = channel.replace("private-conversation-", "");
    const ok = await assertParticipant(conversationId, userId);
    if (!ok) return jsonError("Forbidden", 403);
    const authResponse = pusher.authorizeChannel(socketId, channel);
    return NextResponse.json(authResponse);
  }

  if (channel.startsWith("presence-user-")) {
    const presenceUserId = channel.replace("presence-user-", "");
    if (presenceUserId !== userId) return jsonError("Forbidden", 403);
    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: userId,
      user_info: {
        name: `${auth.session.user.firstName ?? ""} ${auth.session.user.lastName ?? ""}`.trim(),
      },
    });
    return NextResponse.json(authResponse);
  }

  return jsonError("Unsupported channel", 403);
}
