export type ConversationFilter = "all" | "dealers" | "internal" | "unread";

/**
 * The filter tabs above the conversation list. Dealers only talk to Trinity staff, so
 * "Dealers" and "Internal" mean nothing to them and are left out.
 */
export function conversationFilters(isDealerPortal: boolean): [ConversationFilter, string][] {
  const all: [ConversationFilter, string][] = [
    ["all", "All"],
    ["dealers", "Dealers"],
    ["internal", "Internal"],
    ["unread", "Unread"],
  ];
  return isDealerPortal ? all.filter(([key]) => key === "all" || key === "unread") : all;
}
