import { NextResponse } from "next/server";
import { requireMessagingApi } from "@/lib/api-auth";
import { unreadMessageCount } from "@/lib/messaging/service";

/** The signed-in user's unread messages (visible chats only), for the dealer top-bar bell. */
export async function GET() {
  const auth = await requireMessagingApi();
  if ("error" in auth) return auth.error;
  const unread = await unreadMessageCount(auth.session.user.id);
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });
}
