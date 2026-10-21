/** "Typing" is sent at most this often: each send costs a request, 2 queries and a Pusher message. */
export const TYPING_EVERY_MS = 2_000;

export function shouldSendTyping(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= TYPING_EVERY_MS;
}
