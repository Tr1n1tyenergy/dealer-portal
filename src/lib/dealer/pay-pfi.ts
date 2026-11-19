import type { DealerOrderStatus } from "@prisma/client";
import type { PayPfiPanelProps } from "@/components/dealer/pay-pfi-panel";
import { centsToAmount, paymentTotals, type PaymentLike } from "@/lib/orders/payments";

/** Orders that may open the Pay PFI modal (must also have a PFI and a balance left). */
export const DEALER_PAYABLE_STATUSES: DealerOrderStatus[] = [
  "AWAITING_PAYMENT",
  "PAYMENT_EXCEPTION",
  "PAYMENT_VERIFICATION",
];

export type PayableOrderForPayPfi = {
  id: string;
  reference: string;
  amountDue: string | null;
  odooQuotationNumber: string | null;
  station: { name: string };
  dealerOrganization: { name: string };
  proforma: {
    number: string;
    amount: string;
    subtotal: string | null;
    vatAmount: string | null;
    vatRate: string | null;
  } | null;
  payments: PaymentLike[];
};

/** Map a payable order (+ org) into Pay PFI modal props; null when nothing is left to pay. */
export function toPayPfiProps(order: PayableOrderForPayPfi): PayPfiPanelProps | null {
  if (!order.proforma) return null;
  const totals = paymentTotals(order.proforma.amount ?? order.amountDue, order.payments);
  if (totals.totalCents == null || !totals.balanceCents) return null;
  return {
    orderId: order.id,
    orderReference: order.reference,
    pfiNumber: order.proforma.number || order.odooQuotationNumber,
    stationName: order.station.name,
    organizationName: order.dealerOrganization.name,
    totalAmount: centsToAmount(totals.totalCents),
    paidAmount: centsToAmount(totals.confirmedCents),
    waitingAmount: centsToAmount(totals.waitingCents),
    balance: centsToAmount(totals.balanceCents),
    subtotal: order.proforma.subtotal,
    vatAmount: order.proforma.vatAmount,
    vatRate: order.proforma.vatRate,
  };
}
