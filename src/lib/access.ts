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

/** Staff-only APIs serve internal accounts; dealer and depot logins are refused. */
export function isStaffAccount(accountType: string | null | undefined) {
  return accountType === "INTERNAL";
}

type DepotActor = { role: string; depotId: string | null | undefined };

/** A depot manager may only touch orders released to their own depot; super admins may touch any. */
export function canActOnDepotOrder(actor: DepotActor, orderDepotId: string | null | undefined) {
  if (actor.role === "SUPER_ADMIN") return true;
  return Boolean(actor.depotId) && orderDepotId === actor.depotId;
}

/** Prisma filter for the depot dashboard. A manager with no depot assigned sees nothing. */
export function depotOrderScope(actor: DepotActor) {
  if (actor.role === "SUPER_ADMIN") return {};
  if (!actor.depotId) return { id: { in: [] as string[] } };
  return { depotId: actor.depotId };
}

const PUBLIC_PATHS = [
  "/access",
  "/dealer/login",
  "/dealer/activate",
  "/depot/login",
  "/intelligence/login",
  "/intelligence/forgot-password",
  "/intelligence/reset-password",
  "/intelligence/activate",
];

/** Pages anyone may open without a session (a path or anything below it, e.g. /dealer/activate/<token>). */
export function isPublicPath(path: string) {
  return path === "/" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Where a logged-out visitor goes: the login page of the portal they were trying to reach. */
export function loginPathFor(path: string) {
  if (path === "/dealer" || path.startsWith("/dealer/")) return "/dealer/login";
  if (path === "/depot" || path.startsWith("/depot/")) return "/depot/login";
  if (path === "/intelligence" || path.startsWith("/intelligence/")) return "/intelligence/login";
  return "/access";
}

export function homeForAccount(accountType: string) {
  if (accountType === "DEALER") return "/dealer/dashboard";
  if (accountType === "DEPOT") return "/depot/dashboard";
  return "/intelligence/dashboard";
}
