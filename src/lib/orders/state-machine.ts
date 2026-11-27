import type { DealerOrderStatus } from "@prisma/client";
import type { PaymentTotals } from "./payments";

export const ORDER_TRANSITIONS: Record<DealerOrderStatus, DealerOrderStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ODOO_SYNC_PENDING", "CANCELLED"],
  ODOO_SYNC_PENDING: ["QUOTATION_READY", "ODOO_SYNC_FAILED"],
  ODOO_SYNC_FAILED: ["ODOO_SYNC_PENDING", "CANCELLED"],
  QUOTATION_CREATING: ["QUOTATION_READY", "ODOO_SYNC_FAILED"],
  QUOTATION_READY: ["PFI_PENDING", "REQUIRES_AMENDMENT", "CANCELLED"],
  PFI_PENDING: ["PFI_ISSUED", "ODOO_SYNC_FAILED", "QUOTATION_READY"],
  PFI_ISSUED: ["AWAITING_PAYMENT"],
  AWAITING_PAYMENT: ["PAYMENT_SUBMITTED", "CANCELLED"],
  PAYMENT_SUBMITTED: ["PAYMENT_VERIFICATION", "PAYMENT_EXCEPTION"],
  PAYMENT_VERIFICATION: ["PAYMENT_CONFIRMED", "PAYMENT_EXCEPTION", "AWAITING_PAYMENT"],
  PAYMENT_CONFIRMED: ["ORDER_BOOKED"],
  ORDER_BOOKED: ["WAITING_KRA_INVOICE"],
  WAITING_KRA_INVOICE: ["KRA_INVOICE_RECEIVED"],
  KRA_INVOICE_RECEIVED: ["DEPOT_DOCS_RECEIVED"],
  DEPOT_DOCS_RECEIVED: ["LOADING"],
  RELEASED_TO_DEPOT: ["LOADING", "STOCK_EXCEPTION"],
  LOADING: ["LOADED", "IN_TRANSIT", "STOCK_EXCEPTION"],
  LOADED: ["DISPATCHED"],
  DISPATCHED: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED", "DELIVERY_EXCEPTION"],
  DELIVERED: ["CLOSED"],
  CLOSED: [],
  REQUIRES_AMENDMENT: ["SUBMITTED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  PAYMENT_EXCEPTION: ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "PAYMENT_SUBMITTED"],
  STOCK_EXCEPTION: ["RELEASED_TO_DEPOT", "LOADING"],
  DELIVERY_EXCEPTION: ["IN_TRANSIT", "DELIVERED"],
};

export class InvalidOrderTransition extends Error {
  constructor(from: DealerOrderStatus, to: DealerOrderStatus) {
    super(`Invalid order transition: ${from} -> ${to}`);
    this.name = "InvalidOrderTransition";
  }
}

/** The order left `from` before this request could move it (e.g. a double click). */
export class StaleOrderTransition extends Error {
  constructor(from: DealerOrderStatus, to: DealerOrderStatus) {
    super(`This order was already updated by someone else (expected ${from} before ${to}). Refresh and try again.`);
    this.name = "StaleOrderTransition";
  }
}

/**
 * Runs a status change from a button click. If another click already moved the order,
 * that is the outcome the user wanted, so return null instead of showing an error page.
 */
export async function ignoreStaleTransition<T>(transition: () => Promise<T>): Promise<T | null> {
  try {
    return await transition();
  } catch (error) {
    if (error instanceof StaleOrderTransition) return null;
    throw error;
  }
}

export function canTransition(from: DealerOrderStatus, to: DealerOrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DealerOrderStatus, to: DealerOrderStatus) {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransition(from, to);
  }
}

/** Customer-facing labels. Internal ERP statuses stay hidden. */
export function dealerStatusLabel(status: DealerOrderStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Order Submitted";
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return "Quotation Processing";
    case "PFI_ISSUED":
      return "PFI Ready";
    case "AWAITING_PAYMENT":
      return "Awaiting Payment";
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
      return "Payment Submitted";
    case "PAYMENT_CONFIRMED":
      return "Payment Confirmed";
    case "ORDER_BOOKED":
      return "Order booked";
    case "WAITING_KRA_INVOICE":
      return "Waiting for KRA invoice";
    case "KRA_INVOICE_RECEIVED":
      return "KRA invoice received";
    case "DEPOT_DOCS_RECEIVED":
      return "Depot received documents";
    case "RELEASED_TO_DEPOT":
      return "Loading";
    case "LOADING":
      return "Loading";
    case "LOADED":
      return "Loaded";
    case "DISPATCHED":
    case "IN_TRANSIT":
      return "On the way";
    case "DELIVERED":
      return "Completed";
    case "CLOSED":
      return "Closed";
    case "REQUIRES_AMENDMENT":
      return "Needs Update";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    case "PAYMENT_EXCEPTION":
      return "Payment Review";
    case "STOCK_EXCEPTION":
    case "DELIVERY_EXCEPTION":
      return "Exception";
    default:
      return "In Progress";
  }
}

export const DEALER_TRACKER_STEPS = [
  { key: "submitted", label: "Order Submitted" },
  { key: "quotation", label: "Quotation & PFI" },
  { key: "payment", label: "Payment" },
  { key: "booked", label: "Order booked" },
  { key: "transit", label: "Loading" },
  { key: "delivered", label: "Completed" },
] as const;

export type DealerTrackerStepKey = (typeof DEALER_TRACKER_STEPS)[number]["key"];
export type DealerTrackerStepState = "done" | "active" | "attention" | "pending" | "stopped";
export type DealerTrackerStep = {
  key: DealerTrackerStepKey;
  label: string;
  state: DealerTrackerStepState;
  note: string | null;
};

/** Where an order sits on the tracker: the step it waits on (length = all done). No separate Loading step. */
function trackerPosition(status: DealerOrderStatus): {
  current: number;
  attention?: boolean;
  note?: string;
  stopped?: string;
} {
  switch (status) {
    case "DRAFT":
      return { current: 0, note: "Draft" };
    case "REQUIRES_AMENDMENT":
      return { current: 0, attention: true, note: "Needs attention" };
    case "SUBMITTED":
    case "ODOO_SYNC_PENDING":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return { current: 1, note: "Preparing" };
    case "ODOO_SYNC_FAILED":
      return { current: 1, attention: true, note: "Delayed" };
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return { current: 2, note: "Awaiting payment" };
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
      return { current: 2, note: "Verifying" };
    case "PAYMENT_EXCEPTION":
      return { current: 2, attention: true, note: "Needs attention" };
    case "PAYMENT_CONFIRMED":
      return { current: 3, note: "Booking the order" };
    case "ORDER_BOOKED":
      return { current: 3, note: "Order booked" };
    case "WAITING_KRA_INVOICE":
      return { current: 3, note: "Waiting for KRA invoice" };
    case "KRA_INVOICE_RECEIVED":
      return { current: 3, note: "KRA invoice received" };
    case "DEPOT_DOCS_RECEIVED":
      return { current: 3, note: "Depot received Loading order, gate pass and sales order" };
    case "RELEASED_TO_DEPOT":
    case "LOADING":
    case "LOADED":
      return { current: 4, note: "Loading" };
    case "STOCK_EXCEPTION":
      return { current: 4, attention: true, note: "Delayed" };
    case "DISPATCHED":
    case "IN_TRANSIT":
      return { current: 4, note: "On the way" };
    case "DELIVERY_EXCEPTION":
      return { current: 4, attention: true, note: "Needs attention" };
    case "DELIVERED":
    case "CLOSED":
      return { current: DEALER_TRACKER_STEPS.length };
    case "CANCELLED":
      return { current: 0, stopped: "Order cancelled" };
    case "REJECTED":
      return { current: 0, stopped: "Order rejected" };
  }
}

/**
 * The dealer's order tracker: finished steps are done, the step the order is waiting on is
 * active (or "attention" when something went wrong there), later steps are pending.
 */
export function dealerTrackerSteps(status: DealerOrderStatus): {
  steps: DealerTrackerStep[];
  stopped: string | null;
} {
  const position = trackerPosition(status);
  const steps = DEALER_TRACKER_STEPS.map((step, index): DealerTrackerStep => {
    let state: DealerTrackerStepState;
    if (position.stopped) state = "stopped";
    else if (index < position.current) state = "done";
    else if (index === position.current) state = position.attention ? "attention" : "active";
    else state = "pending";
    const isCurrent = state === "active" || state === "attention";
    const onTheWay = status === "DISPATCHED" || status === "IN_TRANSIT" || status === "DELIVERY_EXCEPTION";
    const bookedLabel =
      status === "WAITING_KRA_INVOICE"
        ? "Waiting for KRA invoice"
        : status === "KRA_INVOICE_RECEIVED"
          ? "KRA invoice received"
          : status === "DEPOT_DOCS_RECEIVED"
            ? "Depot received Loading order, gate pass and sales order"
            : "Order booked";
    const label =
      step.key === "booked" && isCurrent
        ? bookedLabel
        : step.key === "transit" && (onTheWay || index < position.current)
          ? "On the way"
          : step.label;
    const note = isCurrent ? position.note ?? null : null;
    return { key: step.key, label, state, note: note === label ? null : note };
  });
  return { steps, stopped: position.stopped ?? null };
}

/** Secondary line under a tracker step — same Done / Pending / note language on dealer + staff. */
export function trackerStepSecondary(step: DealerTrackerStep): string {
  if (step.state === "done") return "Done";
  if (step.state === "pending") return "Pending";
  if (step.state === "stopped") return "—";
  return step.note ?? (step.state === "attention" ? "Needs attention" : "In progress");
}

const compactKes = (cents: number) => {
  const kes = cents / 100;
  return kes >= 1_000_000 ? `${+(kes / 1_000_000).toFixed(2)}M` : Math.round(kes).toLocaleString("en-GB");
};

/** Tracker step 3 text while some, not all, of the PFI is confirmed ("Part paid: KES 3M of 7.36M"). */
export function paymentStepDetail(totals: PaymentTotals): string | null {
  if (totals.totalCents == null || totals.confirmedCents <= 0 || totals.confirmedCents >= totals.totalCents) return null;
  return `Part paid: KES ${compactKes(totals.confirmedCents)} of ${compactKes(totals.totalCents)}`;
}
