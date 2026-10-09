/** Shared channel name helpers safe for client + server imports. */
export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`;
}

export function userPresenceChannel(userId: string) {
  return `presence-user-${userId}`;
}
