import type { DealerOrder, DealerOrderLine, DealerOrderStatus, Prisma, ProFormaInvoice, Station } from "@prisma/client";
import { dealerStatusLabel } from "@/lib/orders/state-machine";

/** The tabs on the dealer's My Orders list (`?view=`). */
export type DealerOrderView = "all" | "payment" | "documents" | "deliveries";

const PAYMENT_STATUSES: DealerOrderStatus[] = ["PFI_ISSUED", "AWAITING_PAYMENT", "PAYMENT_EXCEPTION"];
const DELIVERY_STATUSES: DealerOrderStatus[] = [
  "RELEASED_TO_DEPOT",
  "LOADING",
  "LOADED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERY_EXCEPTION",
  "DELIVERED",
  "CLOSED",
];

export const DEALER_ORDER_VIEWS: { view: DealerOrderView; label: string; href: string }[] = [
  { view: "all", label: "All", href: "/dealer/orders" },
  { view: "payment", label: "Needs payment", href: "/dealer/orders?view=payment" },
  { view: "documents", label: "PFIs & Documents", href: "/dealer/orders?view=documents" },
  { view: "deliveries", label: "Deliveries", href: "/dealer/orders?view=deliveries" },
];

/** Reads `?view=`; anything that isn't a tab shows All. */
export function parseDealerOrderView(value: string | string[] | undefined): DealerOrderView {
  if (value === "payment" || value === "documents" || value === "deliveries") return value;
  return "all";
}

export function dealerOrderViewWhere(view: DealerOrderView): Prisma.DealerOrderWhereInput {
  switch (view) {
    case "payment":
      return { status: { in: PAYMENT_STATUSES } };
    case "deliveries":
      return { status: { in: DELIVERY_STATUSES } };
    case "documents":
      return { proforma: { isNot: null } };
    default:
      return {};
  }
}

/** One row of the dealer's orders table. */
export type RecentOrderRow = {
  id: string;
  reference: string;
  stationName: string;
  createdAt: string;
  updatedAt: string;
  statusLabel: string;
  tone: string;
  pms: number | null;
  ago: number | null;
  hasPfi: boolean;
};

function statusTone(status: DealerOrderStatus) {
  const label = dealerStatusLabel(status);
  if (label === "Delivered" || label === "Closed") return "delivered";
  if (label === "In Transit" || label === "Dispatched" || label === "Loaded") return "transit";
  if (label === "PFI Ready") return "pfi";
  if (label === "Awaiting Payment" || label.includes("Payment")) return "payment";
  return "processing";
}

export function toDealerOrderRow(
  order: DealerOrder & { station: Station; lines: DealerOrderLine[]; proforma: ProFormaInvoice | null },
): RecentOrderRow {
  return {
    id: order.id,
    reference: order.reference,
    stationName: order.station.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    statusLabel: dealerStatusLabel(order.status),
    tone: statusTone(order.status),
    pms: order.lines.find((l) => l.product === "PMS")?.quantityLitres ?? null,
    ago: order.lines.find((l) => l.product === "AGO")?.quantityLitres ?? null,
    hasPfi: Boolean(order.proforma),
  };
}

/** The orders either side of the current one in a newest-first list. */
export function orderNeighbours(
  newestFirst: { id: string }[],
  currentId: string,
): { older: string | null; newer: string | null } {
  const index = newestFirst.findIndex((o) => o.id === currentId);
  if (index < 0) return { older: null, newer: null };
  return {
    older: newestFirst[index + 1]?.id ?? null,
    newer: index > 0 ? newestFirst[index - 1].id : null,
  };
}
