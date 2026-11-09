import type { DealerOrderStatus } from "@prisma/client";
import type { PayPfiPanelProps } from "@/components/dealer/pay-pfi-panel";

/** Orders that may open the Pay PFI modal (must also have a PFI). */
export const DEALER_PAYABLE_STATUSES: DealerOrderStatus[] = [
  "PFI_ISSUED",
  "AWAITING_PAYMENT",
  "PAYMENT_EXCEPTION",
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
};

/** Map a payable order (+ org) into Pay PFI modal props. */
export function toPayPfiProps(order: PayableOrderForPayPfi): PayPfiPanelProps | null {
  if (!order.proforma) return null;
  return {
    orderId: order.id,
    orderReference: order.reference,
    pfiNumber: order.proforma.number || order.odooQuotationNumber,
    stationName: order.station.name,
    organizationName: order.dealerOrganization.name,
    amountDue: order.amountDue ?? order.proforma.amount,
    subtotal: order.proforma.subtotal,
    vatAmount: order.proforma.vatAmount,
    vatRate: order.proforma.vatRate,
  };
}
