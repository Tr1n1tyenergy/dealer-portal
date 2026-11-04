import { canUser, type StaffUser } from "@/lib/permissions";
import { ORDERS_STAFF_CHANNEL } from "@/lib/pusher/server-channels";

const DEALER_PREFIX = "private-orders-dealer-";

/**
 * Who may subscribe to a live channel: staff who may view Orders get the staff channel, a dealer only its own
 * organisation's channel. Conversation channels keep their own check (participant), so they come back as such.
 */
export function liveChannelAccess(
  user: StaffUser & { dealerOrganizationId?: string | null },
  channel: string,
): "allow" | "deny" | "conversation" {
  if (channel.startsWith("private-conversation-")) return "conversation";
  if (channel === ORDERS_STAFF_CHANNEL) return canUser(user, "orders", "view") ? "allow" : "deny";
  if (channel.startsWith(DEALER_PREFIX)) {
    const org = channel.slice(DEALER_PREFIX.length);
    return user.accountType === "DEALER" && Boolean(org) && user.dealerOrganizationId === org ? "allow" : "deny";
  }
  return "deny";
}
