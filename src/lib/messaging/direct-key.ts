/** Stable direct-conversation key from two user ids (order-independent). */
export function directConversationKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}
