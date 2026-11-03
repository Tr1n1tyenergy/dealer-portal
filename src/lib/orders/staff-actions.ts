import type { DealerOrderStatus } from "@prisma/client";

/** A button on a staff order row; each posts one `internalOrderAction` action. */
export type StaffOrderAction = "retry-sync" | "generate-pfi" | "finish-pfi" | "confirm-payment" | "reject-payment" | "release";

/** What staff can do with an order in this status (shared by Orders and Home). */
export function staffOrderActions(status: DealerOrderStatus): StaffOrderAction[] {
  switch (status) {
    case "ODOO_SYNC_FAILED":
    case "ODOO_SYNC_PENDING":
      return ["retry-sync"];
    case "QUOTATION_READY":
    case "PFI_PENDING":
      return ["generate-pfi"];
    case "PFI_ISSUED":
      return ["finish-pfi"];
    case "PAYMENT_VERIFICATION":
      return ["confirm-payment", "reject-payment"];
    case "PAYMENT_CONFIRMED":
      return ["release"];
    default:
      return [];
  }
}
