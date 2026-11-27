import { canUser } from "@/lib/permissions";

const DEALER_KINDS = ["etims-invoice", "sale-order"];
const DEPOT_KINDS = ["sale-order", "loading-order", "gate-pass"];

/** Who may open a stored order PDF. Anyone else gets the same "not found" as a missing file. */
export function canOpenOrderDocument(
  viewer: {
    accountType?: string;
    role?: string;
    permissions?: string | null;
    dealerOrganizationId?: string | null;
    depotId?: string | null;
  },
  order: { dealerOrganizationId: string; depotId: string | null },
  kind: string,
): boolean {
  if (viewer.accountType === "DEALER") {
    return DEALER_KINDS.includes(kind) && Boolean(viewer.dealerOrganizationId) && viewer.dealerOrganizationId === order.dealerOrganizationId;
  }
  if (viewer.accountType === "DEPOT") {
    if (!DEPOT_KINDS.includes(kind)) return false;
    if (viewer.role === "SUPER_ADMIN") return true;
    return Boolean(viewer.depotId) && order.depotId === viewer.depotId;
  }
  if (viewer.accountType === "INTERNAL") return canUser(viewer, "orders", "view");
  return false;
}
