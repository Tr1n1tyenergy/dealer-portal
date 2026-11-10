import type { DealerOrderStatus } from "@prisma/client";
import { dealerStatusLabel, type DealerTrackerStep } from "./state-machine";

/** The heading and one sentence above the tracker for each order status. */
export function statusCopy(status: DealerOrderStatus) {
  const label = dealerStatusLabel(status);
  switch (status) {
    case "SUBMITTED":
      return {
        label,
        detail: "Your order has been received and is queued for commercial processing.",
      };
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return {
        label: "Quotation processing",
        detail: "Your order has been received and commercial processing is underway.",
      };
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return {
        label,
        detail: "Your Pro Forma Invoice is ready. Complete payment to release the order to depot.",
      };
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
      return {
        label,
        detail: "Payment details have been received and are being verified by Trinity finance.",
      };
    case "PAYMENT_EXCEPTION":
      return {
        label,
        detail: "Trinity finance couldn't verify your payment. Check the details below and submit them again.",
      };
    case "CANCELLED":
      return { label, detail: "This order was cancelled. Place a new order if you still need fuel." };
    case "REJECTED":
      return { label, detail: "Trinity couldn't accept this order. Contact Trinity to find out why." };
    case "DELIVERY_EXCEPTION":
      return { label, detail: "There is a problem with this delivery. Trinity is looking into it and will contact you." };
    case "STOCK_EXCEPTION":
      return { label, detail: "The depot doesn't have enough stock for this order right now. Trinity will contact you." };
    case "DELIVERED":
    case "CLOSED":
      return {
        label,
        detail: "Fuel has been delivered to your station.",
      };
    default:
      return {
        label,
        detail: "Track each stage of this order as Trinity processes it.",
      };
  }
}

/** Document badges follow the same tracker as the progress bar, so the two always agree. */
export function docState(
  kind: "quotation" | "pfi" | "payment" | "delivery",
  steps: DealerTrackerStep[],
  status: DealerOrderStatus,
  hasPfi: boolean,
) {
  const stateOf = (key: DealerTrackerStep["key"]) => steps.find((s) => s.key === key)?.state;
  if (kind === "quotation") {
    if (hasPfi || stateOf("quotation") === "done") return { label: "Ready", tone: "ready" as const };
    const quotation = stateOf("quotation");
    if (quotation === "active" || quotation === "attention") {
      return { label: "Processing", tone: "processing" as const };
    }
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "pfi") {
    if (hasPfi) return { label: "Ready", tone: "ready" as const };
    return { label: "Pending", tone: "pending" as const };
  }
  if (kind === "payment") {
    if (stateOf("payment") === "done") return { label: "Ready", tone: "ready" as const };
    if (status === "AWAITING_PAYMENT" || status === "PFI_ISSUED" || status === "PAYMENT_EXCEPTION") {
      return { label: "Action needed", tone: "action" as const };
    }
    return { label: "Pending", tone: "pending" as const };
  }
  if (stateOf("delivered") === "done") return { label: "Ready", tone: "ready" as const };
  return { label: "Pending", tone: "pending" as const };
}
