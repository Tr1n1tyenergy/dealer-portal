import type { DealerOrderStatus } from "@prisma/client";

/** Tabs/KPIs on Retail Interface → Orders. Client-safe: only the status type comes from Prisma. */
export type StageKey =
  | "quotation"
  | "awaiting-payment"
  | "checking-payment"
  | "payment-confirmed"
  | "depot"
  | "transit"
  | "complete"
  | "exceptions";

export const ORDER_STAGES: { key: StageKey; label: string; statuses: DealerOrderStatus[] }[] = [
  {
    key: "quotation",
    label: "Quotation & PFI",
    statuses: ["DRAFT", "SUBMITTED", "ODOO_SYNC_PENDING", "QUOTATION_CREATING", "QUOTATION_READY", "PFI_PENDING"],
  },
  { key: "awaiting-payment", label: "Awaiting Payment", statuses: ["PFI_ISSUED", "AWAITING_PAYMENT"] },
  { key: "checking-payment", label: "Checking Payment", statuses: ["PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION"] },
  { key: "payment-confirmed", label: "Payment Confirmed", statuses: ["PAYMENT_CONFIRMED"] },
  { key: "depot", label: "At Depot", statuses: ["RELEASED_TO_DEPOT", "LOADING", "LOADED"] },
  { key: "transit", label: "In Transit", statuses: ["DISPATCHED", "IN_TRANSIT"] },
  { key: "complete", label: "Completed", statuses: ["DELIVERED", "CLOSED"] },
  {
    key: "exceptions",
    label: "Exceptions",
    statuses: [
      "ODOO_SYNC_FAILED",
      "PAYMENT_EXCEPTION",
      "STOCK_EXCEPTION",
      "DELIVERY_EXCEPTION",
      "REQUIRES_AMENDMENT",
      "REJECTED",
      "CANCELLED",
    ],
  },
];

export function stageOf(status: DealerOrderStatus): StageKey {
  return ORDER_STAGES.find((stage) => stage.statuses.includes(status))?.key ?? "exceptions";
}

/** The ?stage= value; anything that is not a tab shows every order. */
export function parseStage(value: unknown): StageKey | "all" {
  return ORDER_STAGES.find((stage) => stage.key === value)?.key ?? "all";
}

/** PAYMENT_VERIFICATION → "Payment verification"; keeps Odoo and PFI readable. */
export function statusLabel(status: string): string {
  const words = status.toLowerCase().split("_").map((word) => (word === "odoo" ? "Odoo" : word === "pfi" ? "PFI" : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
