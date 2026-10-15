import type { DealerOrderStatus } from "@prisma/client";

/** Tabs on Retail Interface → Orders. Client-safe: only the status type comes from Prisma. */
export type StageKey = "pending" | "awaiting-payment" | "verification" | "paid" | "depot" | "complete" | "exceptions";

export const ORDER_STAGES: { key: StageKey; label: string; statuses: DealerOrderStatus[] }[] = [
  {
    key: "pending",
    label: "Pending",
    statuses: ["DRAFT", "SUBMITTED", "ODOO_SYNC_PENDING", "QUOTATION_CREATING", "QUOTATION_READY", "PFI_PENDING"],
  },
  { key: "awaiting-payment", label: "Awaiting payment", statuses: ["PFI_ISSUED", "AWAITING_PAYMENT"] },
  { key: "verification", label: "Payment verification", statuses: ["PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION"] },
  { key: "paid", label: "Payment completed", statuses: ["PAYMENT_CONFIRMED"] },
  { key: "depot", label: "At depot", statuses: ["RELEASED_TO_DEPOT", "LOADING", "LOADED", "DISPATCHED", "IN_TRANSIT"] },
  { key: "complete", label: "Order complete", statuses: ["DELIVERED", "CLOSED"] },
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

/** The ?stage= value, or Pending (the default tab) for anything unknown. */
export function parseStage(value: unknown): StageKey | "all" {
  if (value === "all") return "all";
  return ORDER_STAGES.find((stage) => stage.key === value)?.key ?? "pending";
}

/** PAYMENT_VERIFICATION → "Payment verification"; keeps Odoo and PFI readable. */
export function statusLabel(status: string): string {
  const words = status.toLowerCase().split("_").map((word) => (word === "odoo" ? "Odoo" : word === "pfi" ? "PFI" : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
