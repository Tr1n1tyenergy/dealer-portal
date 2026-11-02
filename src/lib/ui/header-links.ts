import { canUser, type PermissionModule, type StaffUser } from "@/lib/permissions";

export type HeaderLink = { key: string; label: string; href: string };
export type HeaderGroup = { key: string; label: string; links: HeaderLink[] };

const DEALER: HeaderLink[] = [
  { key: "dashboard", label: "Dashboard", href: "/dealer/dashboard" },
  { key: "orders", label: "Orders", href: "/dealer/orders" },
  { key: "pfis", label: "PFIs", href: "/dealer/orders?view=documents" },
  { key: "messaging", label: "Messages", href: "/dealer/messaging" },
  { key: "support", label: "Support", href: "#support" },
];

const STAFF: (HeaderLink & { module?: PermissionModule })[] = [
  { key: "home", label: "Home", href: "/intelligence/dashboard" },
  { key: "orders", label: "Orders", href: "/intelligence/retail/orders", module: "orders" },
  { key: "analytics", label: "Analytics", href: "/intelligence/retail", module: "analytics" },
  { key: "messaging", label: "Messages", href: "/intelligence/retail/messaging", module: "messaging" },
  { key: "users", label: "Users", href: "/intelligence/retail/users", module: "retailUsers" },
];

const ADMIN: (HeaderLink & { module: PermissionModule })[] = [
  { key: "admin-users", label: "Admin users", href: "/intelligence/admin/users", module: "adminUsers" },
  { key: "activity", label: "Activity log", href: "/intelligence/admin/activity", module: "activity" },
  { key: "settings", label: "Settings", href: "/intelligence/admin/settings", module: "settings" },
];

const strip = ({ key, label, href }: HeaderLink): HeaderLink => ({ key, label, href });

/** The header's menu for a portal; staff links only where the person may view (redesign spec §4). */
export function headerLinks(portal: "dealer" | "staff" | "depot", user?: StaffUser): (HeaderLink | HeaderGroup)[] {
  if (portal === "dealer") return DEALER;
  if (portal === "depot") return [{ key: "board", label: "Loading board", href: "/depot/dashboard" }];
  const may = (module?: PermissionModule) => !module || canUser(user, module, "view");
  const admin = ADMIN.filter((l) => may(l.module)).map(strip);
  const links: (HeaderLink | HeaderGroup)[] = STAFF.filter((l) => may(l.module)).map(strip);
  return admin.length ? [...links, { key: "admin", label: "Admin", links: admin }] : links;
}

/** Which staff menu word (or Admin entry) to underline for a page. */
export function activeStaffNav(pathname: string): string | null {
  const path = pathname.replace(/\/$/, "");
  if (path === "/intelligence/retail") return "analytics";
  const match = [...STAFF, ...ADMIN].find((l) => l.href !== "/intelligence/retail" && path.startsWith(l.href));
  return match?.key ?? null;
}
