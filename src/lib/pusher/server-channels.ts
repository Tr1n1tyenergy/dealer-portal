/** Shared channel name helpers safe for client + server imports. */
export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`;
}


/** Staff dashboards listen here for order changes (staff who may view Orders). */
export const ORDERS_STAFF_CHANNEL = "private-orders-staff";

/** One dealer organisation's dashboards listen here for changes to its own orders. */
export function ordersDealerChannel(dealerOrganizationId: string) {
  return `private-orders-dealer-${dealerOrganizationId}`;
}
