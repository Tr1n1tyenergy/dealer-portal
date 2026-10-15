import { MessagingApp } from "@/components/messaging/messaging-app";
import { listConversationsForUser } from "@/lib/messaging/service";
import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { requireInternal } from "@/lib/session";
import "@/app/intelligence/retail/retail-messaging.css";

export default async function RetailMessagingPage() {
  const session = await requireInternal();
  if (!can(session.user.role, "retail.messaging")) redirect("/intelligence/retail");
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
    <div className="rm" style={{ background: "#0a192f" }}>
      <div className="rm-hero" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets2/img/retail/dashboard-hero-station.jpg"
          alt=""
          className="rm-hero__img"
        />
        <div className="rm-hero__fade" />
      </div>

      <header className="rm-head">
        <h1>Messaging</h1>
        <p>Real-time conversations with dealers and internal teams.</p>
      </header>

      <div className="rm-workspace">
        <MessagingApp variant="staff" initialConversations={initialConversations} />
      </div>
    </div>
  );
}
