import { prisma } from "@/lib/prisma";
import { eventLine } from "@/lib/insights/order-flow";

export type FeedEvent = { id: string; at: string; text: string; amount: string | null };
const WITH_AMOUNT = ["PAYMENT_SUBMITTED", "AWAITING_PAYMENT", "PFI_ISSUED"];

/** The latest order status changes, worded for the "Happening now" feed. */
export async function recentEvents(take = 6): Promise<FeedEvent[]> {
  const rows = await prisma.orderStatusHistory.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      toStatus: true,
      createdAt: true,
      order: { select: { reference: true, amountDue: true, dealerOrganization: { select: { name: true } }, depot: { select: { name: true } } } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    at: e.createdAt.toISOString(),
    text: eventLine({ toStatus: e.toStatus, reference: e.order.reference, dealer: e.order.dealerOrganization.name, depot: e.order.depot?.name }),
    amount: WITH_AMOUNT.includes(e.toStatus) ? e.order.amountDue : null,
  }));
}
