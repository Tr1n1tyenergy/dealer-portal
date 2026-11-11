import { MessagingApp } from "@/components/messaging/messaging-app";
import { listConversationsForUser } from "@/lib/messaging/service";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import "@/app/intelligence/retail/staff-orders.css";
import "@/app/intelligence/retail/staff-messages.css";

export default async function RetailMessagingPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "messaging", "view")) redirect("/intelligence/retail");
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
    <div className="so sm">
      <header className="so-hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Staff Portal</div>
          <h1>Messages</h1>
          <p>Real-time conversations with dealers and the Trinity team.</p>
        </div>
      </header>
      <div className="so-wrap sm__workspace">
        <MessagingApp
          variant="staff"
          appearance="light"
          initialConversations={initialConversations}
          canOpenUsers={canUser(session.user, "retailUsers", "view")}
        />
      </div>
    </div>
  );
}
