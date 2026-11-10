import { NextResponse } from "next/server";
import { jsonError, requireSessionApi } from "@/lib/api-auth";
import { liveChannelAccess } from "@/lib/live/channel-access";
import { canUseMessaging } from "@/lib/messaging/authz";
import { getPusherServer, pusherConfigured } from "@/lib/pusher/server";
import { assertParticipant } from "@/lib/messaging/service";

/** Pusher private-channel auth: message threads for their participants, live order channels per liveChannelAccess. */
export async function POST(req: Request) {
  const auth = await requireSessionApi();
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

  const user = auth.session.user;
  const access = liveChannelAccess(user, channel);
  if (access === "conversation") {
    // Same rule as before: messaging accounts, and only threads they take part in.
    if (!canUseMessaging(user)) return jsonError("Messaging is not available for this account.", 403);
    const ok = await assertParticipant(channel.replace("private-conversation-", ""), user.id);
    if (!ok) return jsonError("Forbidden", 403);
  } else if (access === "deny") {
    return jsonError("Forbidden", 403);
  }
  return NextResponse.json(pusher.authorizeChannel(socketId, channel));
}
