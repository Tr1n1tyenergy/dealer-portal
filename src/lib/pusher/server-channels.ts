/** Shared channel name helpers safe for client + server imports. */
export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`;
}

