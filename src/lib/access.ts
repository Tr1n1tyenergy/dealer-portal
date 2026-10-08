export type AccountType = "INTERNAL" | "DEALER" | "DEPOT";

export const INTERNAL_ROLES = ["SUPER_ADMIN", "STANDARD_USER", "SALES_REP", "FINANCE"] as const;
export const DEPOT_ROLES = ["DEPOT_MANAGER"] as const;
export const DEALER_ROLES = ["DEALER_ADMIN", "DEALER_USER"] as const;

export function isInternalRole(role: string) {
  return (INTERNAL_ROLES as readonly string[]).includes(role);
}

export function canManageCommercialOrders(role: string) {
  return role === "SUPER_ADMIN" || role === "SALES_REP" || role === "FINANCE" || role === "STANDARD_USER";
}

export function canVerifyPayment(role: string) {
  return role === "SUPER_ADMIN" || role === "FINANCE" || role === "SALES_REP";
}

export function canReleaseToDepot(role: string) {
  return role === "SUPER_ADMIN" || role === "SALES_REP";
}

export function canOperateDepot(role: string) {
  return role === "SUPER_ADMIN" || role === "DEPOT_MANAGER";
}

export function homeForAccount(accountType: string) {
  if (accountType === "DEALER") return "/dealer/dashboard";
  if (accountType === "DEPOT") return "/depot/dashboard";
  return "/intelligence/dashboard";
}
