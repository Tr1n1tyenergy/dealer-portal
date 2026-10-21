import type { DealerOrderStatus } from "@prisma/client";

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
  PAYMENT_VERIFICATION: ["PAYMENT_CONFIRMED", "PAYMENT_EXCEPTION"],
  PAYMENT_CONFIRMED: ["RELEASED_TO_DEPOT"],
  RELEASED_TO_DEPOT: ["LOADING", "STOCK_EXCEPTION"],
  LOADING: ["LOADED", "STOCK_EXCEPTION"],
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
    case "RELEASED_TO_DEPOT":
      return "Released to Depot";
    case "LOADING":
      return "Loading";
    case "LOADED":
      return "Loaded";
    case "DISPATCHED":
    case "IN_TRANSIT":
      return "In Transit";
    case "DELIVERED":
      return "Delivered";
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
  { key: "release", label: "Released to Depot" },
  { key: "loading", label: "Loading" },
  { key: "transit", label: "On the Way" },
  { key: "delivered", label: "Delivered" },
] as const;

export type DealerTrackerStepKey = (typeof DEALER_TRACKER_STEPS)[number]["key"];
export type DealerTrackerStepState = "done" | "active" | "attention" | "pending" | "stopped";
export type DealerTrackerStep = {
  key: DealerTrackerStepKey;
  label: string;
  state: DealerTrackerStepState;
  note: string | null;
};

/** Where an order sits on the dealer's tracker: the step it waits on (7 = all done). */
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
      return { current: 3 };
    case "RELEASED_TO_DEPOT":
    case "LOADING":
      return { current: 4 };
    case "LOADED":
      return { current: 4, note: "Loaded" };
    case "STOCK_EXCEPTION":
      return { current: 4, attention: true, note: "Delayed" };
    case "DISPATCHED":
    case "IN_TRANSIT":
      return { current: 5 };
    case "DELIVERY_EXCEPTION":
      return { current: 5, attention: true, note: "Needs attention" };
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
    return { key: step.key, label: step.label, state, note: isCurrent ? position.note ?? null : null };
  });
  return { steps, stopped: position.stopped ?? null };
}
