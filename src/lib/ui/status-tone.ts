import type { DealerOrderStatus } from "@prisma/client";

/** Chip colour by who acts next: the dealer, Trinity, the truck; or finished, a problem, or set aside. */
export type Tone = "dealer" | "trinity" | "moving" | "done" | "problem" | "muted";

const TONES: Record<DealerOrderStatus, Tone> = {
  DRAFT: "muted",
  SUBMITTED: "trinity",
  ODOO_SYNC_PENDING: "trinity",
  ODOO_SYNC_FAILED: "problem",
  QUOTATION_CREATING: "trinity",
  QUOTATION_READY: "trinity",
  PFI_PENDING: "trinity",
  PFI_ISSUED: "dealer",
  AWAITING_PAYMENT: "dealer",
  PAYMENT_SUBMITTED: "trinity",
  PAYMENT_VERIFICATION: "trinity",
  PAYMENT_CONFIRMED: "trinity",
  RELEASED_TO_DEPOT: "moving",
  LOADING: "moving",
  LOADED: "moving",
  DISPATCHED: "moving",
  IN_TRANSIT: "moving",
  DELIVERED: "done",
  CLOSED: "done",
  REQUIRES_AMENDMENT: "dealer",
  REJECTED: "problem",
  CANCELLED: "muted",
  PAYMENT_EXCEPTION: "problem",
  STOCK_EXCEPTION: "problem",
  DELIVERY_EXCEPTION: "problem",
};

export function statusTone(status: DealerOrderStatus): Tone {
  return TONES[status];
}
