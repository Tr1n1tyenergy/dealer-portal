import { can } from "@/lib/access";

/** Who may open an order's PFI: Admins and Sales Person Executives, and the order's own dealer. */
export function canOpenPfi(
  viewer: { accountType?: string; role?: string; dealerOrganizationId?: string | null },
  orderOrganizationId: string,
): boolean {
  if (viewer.accountType === "INTERNAL") return can(viewer.role, "retail.orders");
  if (viewer.accountType === "DEALER") return Boolean(viewer.dealerOrganizationId) && viewer.dealerOrganizationId === orderOrganizationId;
  return false;
}
