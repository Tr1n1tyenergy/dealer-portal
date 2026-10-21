/**
 * Replace a sent message's temporary bubble with the saved one. Pusher may have delivered the saved
 * message first; then the temporary bubble is just dropped, so the message never shows twice.
 */
export function settleSentMessage<T extends { id: string }>(list: T[], tempId: string, saved: T): T[] {
  if (list.some((m) => m.id === saved.id)) return list.filter((m) => m.id !== tempId);
  return list.map((m) => (m.id === tempId ? saved : m));
}
