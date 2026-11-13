import { requireDealer } from "@/lib/session";
import { DealerHeroActions } from "@/components/dealer/dealer-hero-actions";
import { SupportTicketDetail } from "@/components/dealer/support-ticket-detail";
import { DealerHeroMedia } from "@/components/dealer/dealer-hero-media";
import "../../../../dealer-support.css";
import "../../../../dealer-portal-hero.css";

export default async function DealerSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDealer();
  const { id } = await params;

  return (
    <div className="ds">
      <section className="ds__hero">
        <DealerHeroMedia />
        <div className="ds__hero-veil" aria-hidden />
        <div className="ds__hero-inner">
          <div className="ds__hero-copy">
            <span className="ds__hero-accent" aria-hidden />
            <div>
              <h1>Support Centre</h1>
              <p>Raise a ticket, track its progress and get help from the Trinity team.</p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <SupportTicketDetail ticketId={id} myUserId={session.user.id} />
    </div>
  );
}
