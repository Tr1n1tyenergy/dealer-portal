import { requireDealer } from "@/lib/session";
import { SupportTicketDetail } from "@/components/dealer/support-ticket-detail";
import "../../../../dealer-support.css";
import "../../../../dealer-portal-hero.css";

export default async function DealerSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDealer();
  const { id } = await params;

  return <SupportTicketDetail ticketId={id} myUserId={session.user.id} />;
}
