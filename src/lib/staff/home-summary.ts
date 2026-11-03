import type { DealerOrderStatus } from "@prisma/client";

const ORDERS = "/intelligence/retail/orders";

/** What waits on Trinity, in the order staff should deal with it (redesign spec §5). */
const GROUPS: { statuses: DealerOrderStatus[]; one: string; many: string; label: string; stage: string }[] = [
  { statuses: ["PAYMENT_SUBMITTED", "PAYMENT_VERIFICATION"], one: "payment to check", many: "payments to check", label: "Check payments", stage: "verification" },
  { statuses: ["PAYMENT_CONFIRMED"], one: "order to release", many: "orders to release", label: "Release orders", stage: "paid" },
  { statuses: ["QUOTATION_READY", "PFI_PENDING", "PFI_ISSUED"], one: "PFI to issue", many: "PFIs to issue", label: "Issue PFIs", stage: "pending" },
  { statuses: ["ODOO_SYNC_FAILED"], one: "order stuck at Odoo", many: "orders stuck at Odoo", label: "Fix Odoo sync", stage: "exceptions" },
];

/** The staff home's sentence and up to two buttons, from order counts by status. */
export function staffHomeSummary(counts: Partial<Record<DealerOrderStatus, number>>): {
  sentence: string;
  actions: { label: string; href: string }[];
} {
  const waiting = GROUPS.map((g) => ({ ...g, n: g.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0) })).filter((g) => g.n > 0);
  if (waiting.length === 0) return { sentence: "Nothing waits on Trinity right now.", actions: [] };
  return {
    sentence: `${waiting.map((g) => `${g.n} ${g.n === 1 ? g.one : g.many}`).join(", ")}.`,
    actions: waiting.slice(0, 2).map((g) => ({ label: g.label, href: `${ORDERS}?stage=${g.stage}` })),
  };
}

/** The statuses the home's "Needs action" list shows. */
export const NEEDS_ACTION: DealerOrderStatus[] = GROUPS.flatMap((g) => g.statuses);
