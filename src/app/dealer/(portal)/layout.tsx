import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { unreadMessageCount } from "@/lib/messaging/service";
import { DEALER_PAYABLE_STATUSES, toPayPfiProps } from "@/lib/dealer/pay-pfi";
import "../dealer-portal.css";
import "../dealer-portal-hero.css";

export default async function DealerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const [org, unread, payableOrders] = await Promise.all([
    prisma.dealerOrganization.findUnique({
      where: { id: orgId },
      include: {
        stations: {
          select: { tradingName: true, name: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    // The bell is a nicety: a messaging error must not take every dealer page down.
    unreadMessageCount(session.user.id).catch(() => 0),
    prisma.dealerOrder.findMany({
      where: {
        dealerOrganizationId: orgId,
        status: { in: DEALER_PAYABLE_STATUSES },
        proforma: { isNot: null },
      },
      select: {
        id: true,
        reference: true,
        amountDue: true,
        odooQuotationNumber: true,
        station: { select: { name: true } },
        proforma: {
          select: { number: true, amount: true, subtotal: true, vatAmount: true, vatRate: true },
        },
        payments: { select: { amount: true, status: true } },
        dealerOrganization: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);
  // Post-activation: trading name is the primary dealer label
  const orgName =
    org?.stations[0]?.tradingName ||
    org?.stations[0]?.name ||
    org?.name ||
    "Dealer Account";
  const initials = (org?.code ?? orgName)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase() || "AB";

  // The oldest order with a balance left (an order whose payments all wait for checking has none).
  const payPfi = payableOrders.map((o) => toPayPfiProps(o)).find((props) => props != null) ?? null;

  return (
    <DealerShell
      orgName={orgName}
      initials={initials}
      name={
        `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() ||
        orgName
      }
      email={session.user.email ?? ""}
      unread={unread}
      payPfi={payPfi}
    >
      {children}
    </DealerShell>
  );
}
