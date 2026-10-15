export type AccountType = "INTERNAL" | "DEALER" | "DEPOT";

/** The three staff roles: Admin, Sales Person Executive and Staff Member. */
export const STAFF_ROLES = ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE", "STANDARD_USER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const DEPOT_ROLES = ["DEPOT_MANAGER"] as const;
export const DEALER_ROLES = ["DEALER_ADMIN", "DEALER_USER"] as const;

export function isInternalRole(role: string) {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** What people see for each stored role value. */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Admin",
  SALES_PERSON_EXECUTIVE: "Sales Person Executive",
  STANDARD_USER: "Staff Member",
  DEPOT_MANAGER: "Depot Manager",
  DEALER_ADMIN: "Dealer Admin",
  DEALER_USER: "Dealer User",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Staff";
  return ROLE_LABELS[role] ?? role;
}

export function canManageCommercialOrders(role: string) {
  return role === "SUPER_ADMIN" || role === "SALES_PERSON_EXECUTIVE";
}

export function canVerifyPayment(role: string) {
  return role === "SUPER_ADMIN" || role === "SALES_PERSON_EXECUTIVE";
}

export function canReleaseToDepot(role: string) {
  return role === "SUPER_ADMIN" || role === "SALES_PERSON_EXECUTIVE";
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
