import { MessagingApp } from "@/components/messaging/messaging-app";
import { DealerHeroActions } from "@/components/dealer/dealer-hero-actions";
import { listConversationsForUser } from "@/lib/messaging/service";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import { requireDealer } from "@/lib/session";
import "../../dealer-messaging.css";

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
    <div className="dm">
      <section className="dm__hero" style={dealerHeroPhotoStyle}>
        <div className="dm__hero-veil" aria-hidden />
        <div className="dm__hero-inner">
          <div className="dm__hero-copy">
            <span className="dm__hero-accent" aria-hidden />
            <div>
              <h1>Messages</h1>
              <p>Real-time conversations with the Trinity team.</p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <div className="dm__workspace">
        <MessagingApp variant="dealer" initialConversations={initialConversations} />
      </div>
    </div>
  );
}
