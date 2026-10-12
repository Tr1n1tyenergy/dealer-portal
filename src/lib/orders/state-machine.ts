import type { DealerOrderStatus } from "@prisma/client";

export const ORDER_TRANSITIONS: Record<DealerOrderStatus, DealerOrderStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ODOO_SYNC_PENDING", "CANCELLED"],
  ODOO_SYNC_PENDING: ["QUOTATION_READY", "ODOO_SYNC_FAILED"],
  ODOO_SYNC_FAILED: ["ODOO_SYNC_PENDING", "CANCELLED"],
  QUOTATION_CREATING: ["QUOTATION_READY", "ODOO_SYNC_FAILED"],
  QUOTATION_READY: ["PFI_PENDING", "REQUIRES_AMENDMENT", "CANCELLED"],
  PFI_PENDING: ["PFI_ISSUED", "ODOO_SYNC_FAILED"],
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
  PAYMENT_EXCEPTION: ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION"],
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

export const DEALER_PROGRESS_STEPS = [
  "Order Submitted",
  "Quotation Processed",
  "PFI Issued",
  "Payment",
  "Depot Release",
  "Loading",
  "Dispatch",
  "In Transit",
  "Delivered",
] as const;

export function dealerProgressIndex(status: DealerOrderStatus): number {
  switch (status) {
    case "DRAFT":
      return -1;
    case "SUBMITTED":
      return 0;
    case "ODOO_SYNC_PENDING":
    case "ODOO_SYNC_FAILED":
    case "QUOTATION_CREATING":
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return 1;
    case "PFI_ISSUED":
    case "AWAITING_PAYMENT":
      return 2;
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VERIFICATION":
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_EXCEPTION":
      return 3;
    case "RELEASED_TO_DEPOT":
    case "STOCK_EXCEPTION":
      return 4;
    case "LOADING":
    case "LOADED":
      return 5;
    case "DISPATCHED":
      return 6;
    case "IN_TRANSIT":
    case "DELIVERY_EXCEPTION":
      return 7;
    case "DELIVERED":
    case "CLOSED":
      return 8;
    default:
      return 0;
  }
}
