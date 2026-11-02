import { canUser } from "@/lib/permissions";

/** Who may open an order's PFI: Admins and Sales Person Executives, and the order's own dealer. */
export function canOpenPfi(
  viewer: { accountType?: string; role?: string; permissions?: string | null; dealerOrganizationId?: string | null },
  orderOrganizationId: string,
): boolean {
  if (viewer.accountType === "INTERNAL") return canUser(viewer, "orders", "view");
  if (viewer.accountType === "DEALER") return Boolean(viewer.dealerOrganizationId) && viewer.dealerOrganizationId === orderOrganizationId;
  return false;
}
