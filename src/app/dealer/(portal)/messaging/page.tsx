import { MessagingApp } from "@/components/messaging/messaging-app";
import { listConversationsForUser } from "@/lib/messaging/service";
import { requireDealer } from "@/lib/session";
import { PageHead } from "@/components/layout/page-head";
import "./messaging-page.css";

export default async function DealerMessagingPage() {
  const session = await requireDealer();
  const conversations = await listConversationsForUser(session.user.id).catch(() => []);

  const initialConversations = conversations.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt ? String(c.lastMessageAt) : null,
    lastReadAt: c.lastReadAt ? String(c.lastReadAt) : null,
    lastMessage: c.lastMessage
      ? { ...c.lastMessage, createdAt: String(c.lastMessage.createdAt) }
      : null,
    peer: c.peer
      ? {
          ...c.peer,
          lastLoginAt: c.peer.lastLoginAt ? String(c.peer.lastLoginAt) : null,
          locationHint:
            c.peer.stationLabel ?? c.peer.organizationName ?? c.peer.department ?? null,
        }
      : null,
  }));

  return (
    <div className="ui-page dm">
      <PageHead title="Messages" description="Conversations with the Trinity team." />
      <div className="dm__workspace">
        <MessagingApp variant="dealer" initialConversations={initialConversations} />
      </div>
    </div>
  );
}
