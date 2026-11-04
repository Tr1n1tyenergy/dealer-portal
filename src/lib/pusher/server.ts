import Pusher from "pusher";
import { conversationChannel, ORDERS_STAFF_CHANNEL, ordersDealerChannel } from "./server-channels";

export { conversationChannel, ORDERS_STAFF_CHANNEL, ordersDealerChannel } from "./server-channels";

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
      timeout: 3000, // order changes and messages wait for the notice; never longer than this
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
  // Best-effort: the change is already saved; a Pusher outage must not fail the request.
  await pusher.trigger(conversationChannel(conversationId), event, data).catch((error: unknown) => {
    console.warn(`[pusher] ${event} not delivered:`, error instanceof Error ? error.message : error);
  });
}

/**
 * Tells open dashboards an order changed (after the change is saved). Carries the id and status only, never
 * money or names; best-effort like messages, so a Pusher problem never fails the order change.
 */
export async function notifyOrderChanged(order: { id: string; status: string; dealerOrganizationId: string }) {
  const pusher = getPusherServer();
  if (!pusher) return;
  try {
    // trigger() can also throw before sending (bad channel name), hence try/await rather than .catch alone
    await pusher.trigger([ORDERS_STAFF_CHANNEL, ordersDealerChannel(order.dealerOrganizationId)], "order-changed", { orderId: order.id, status: order.status });
  } catch (error: unknown) {
    console.warn("[pusher] order-changed not delivered:", error instanceof Error ? error.message : error);
  }
}
