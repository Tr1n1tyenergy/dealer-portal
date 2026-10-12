import Pusher from "pusher";
import { conversationChannel } from "./server-channels";

export { conversationChannel, userPresenceChannel } from "./server-channels";

let client: Pusher | null = null;

export function pusherConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID?.trim() &&
      process.env.PUSHER_KEY?.trim() &&
      process.env.PUSHER_SECRET?.trim() &&
      process.env.PUSHER_CLUSTER?.trim()
  );
}

export function getPusherServer(): Pusher | null {
  if (!pusherConfigured()) return null;
  if (!client) {
    client = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return client;
}

export async function triggerConversationEvent(
  conversationId: string,
  event: string,
  data: Record<string, unknown>
) {
  const pusher = getPusherServer();
  if (!pusher) return;
  await pusher.trigger(conversationChannel(conversationId), event, data);
}
