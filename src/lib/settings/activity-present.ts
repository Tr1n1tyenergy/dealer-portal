/** Pure presentation helpers for ActivityLog rows (safe for client imports). */

export type ActivityModuleKey =
  | "users"
  | "auth"
  | "orders"
  | "stations"
  | "tanks"
  | "fleet"
  | "reports"
  | "presentations"
  | "support"
  | "permissions"
  | "dealers"
  | "settings"
  | "other";

export type ActivityActionKind =
  | "login"
  | "created"
  | "updated"
  | "deleted"
  | "viewed"
  | "access"
  | "other";

export type ActivityOutcome = "success" | "failed";

export const ACTIVITY_MODULES: Array<{ key: ActivityModuleKey; label: string }> = [
  { key: "users", label: "Users" },
  { key: "auth", label: "Authentication" },
  { key: "orders", label: "Orders" },
  { key: "stations", label: "Stations & Pricing" },
  { key: "tanks", label: "Tanks" },
  { key: "fleet", label: "Fleet & Trucks" },
  { key: "reports", label: "Reports" },
  { key: "presentations", label: "Presentations" },
  { key: "support", label: "Support" },
  { key: "permissions", label: "Access & Permissions" },
  { key: "dealers", label: "Dealer Management" },
  { key: "settings", label: "Settings" },
  { key: "other", label: "Other" },
];

export const ACTIVITY_ACTION_KINDS: Array<{ key: ActivityActionKind; label: string }> = [
  { key: "login", label: "Login" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "deleted", label: "Deleted" },
  { key: "viewed", label: "Viewed" },
  { key: "access", label: "Access & Permissions" },
  { key: "other", label: "Other" },
];

export function parseMeta(metaJson: string | null | undefined): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    const v = JSON.parse(metaJson) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function classifyModule(action: string, entity: string | null | undefined): ActivityModuleKey {
  const a = action.toUpperCase();
  const e = (entity ?? "").toLowerCase();

  if (a.includes("LOGIN") || a.includes("PASSWORD") || a.includes("ACTIVATED") || a.includes("RESET")) {
    if (a.includes("PERMISSION") || a.includes("ROLE") || a.includes("ACCESS")) return "permissions";
    return a.includes("LOGIN") || a.includes("PASSWORD") || a.includes("ACTIVATED") ? "auth" : "permissions";
  }
  if (
    a.includes("PERMISSION") ||
    a.includes("ROLE") ||
    a.includes("ACCESS_GRANTED") ||
    e === "staffroletemplate" ||
    e === "systemsetting"
  ) {
    return "permissions";
  }
  if (e === "stationtank" || a.includes("TANK_")) return "tanks";
  if (e === "fleettruck" || a.includes("TRUCK_")) return "fleet";
  if (e === "station" || a.includes("STATION_")) return "stations";
  if (e === "dealerorder" || a.includes("ORDER") || a.includes("PFI") || a.includes("ODOO_QUOTATION") || a.includes("PAYMENT")) {
    return "orders";
  }
  if (e === "presentation" || a.includes("PRESENTATION")) return "presentations";
  if (e === "report" || e === "notesession" || a.includes("REPORT") || a.includes("STOCK_REPORT") || a.includes("NOTE_SESSION")) {
    return "reports";
  }
  if (e === "supportticket" || a.toLowerCase().startsWith("support.")) return "support";
  if (e === "dealerorganization" || a.includes("DEALER_")) return "dealers";
  if (e === "user" || a.includes("USER_") || a.includes("STAFF_INVITED")) return "users";
  if (a.includes("SETTINGS") || a.includes("GO_LIVE")) return "settings";
  return "other";
}

export function classifyActionKind(action: string): ActivityActionKind {
  const a = action.toUpperCase();
  if (a.includes("LOGIN")) return "login";
  if (a.includes("DELETE") || a.includes("REMOVED") || a.includes("VOID")) return "deleted";
  if (
    a.includes("PERMISSION") ||
    a.includes("ROLE") ||
    a.includes("ACCESS") ||
    a.includes("INVITED") ||
    a.includes("ACTIVATED")
  ) {
    return "access";
  }
  if (a.includes("VIEW") || a.includes("EXPORT") || a.includes("DOWNLOADED")) return "viewed";
  if (
    a.includes("CREATE") ||
    a.includes("CREATED") ||
    a.includes("SUBMITTED") ||
    a.includes("GENERATED") ||
    a.includes("INVITED")
  ) {
    return "created";
  }
  if (a.includes("UPDATE") || a.includes("CHANGED") || a.includes("STATUS") || a.includes("CORRECT")) {
    return "updated";
  }
  return "other";
}

export function classifyOutcome(action: string, meta: Record<string, unknown>): ActivityOutcome {
  const a = action.toUpperCase();
  if (a.includes("REFUSED") || a.includes("FAILED") || a.includes("REJECTED") || meta.error || meta.failed) {
    return "failed";
  }
  return "success";
}

export function moduleLabel(key: ActivityModuleKey): string {
  return ACTIVITY_MODULES.find((m) => m.key === key)?.label ?? "Other";
}

function metaStr(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function describeActivity(
  action: string,
  entity: string | null | undefined,
  meta: Record<string, unknown>
): string {
  const a = action.toUpperCase();
  const name = metaStr(meta, "name") ?? metaStr(meta, "label") ?? metaStr(meta, "truckNumber");
  const reference = metaStr(meta, "reference") ?? metaStr(meta, "quotationNumber");
  const portal = metaStr(meta, "portal");

  if (a === "USER_LOGIN") return portal ? `User logged into the ${portal} portal` : "User logged into the system";
  if (a === "USER_CREATED") return "Created a user account";
  if (a === "USER_UPDATED") return "Updated user profile";
  if (a === "USER_DELETED") return "Deleted a user account";
  if (a === "USER_PERMISSIONS_CHANGED") return "Updated user permissions";
  if (a === "STAFF_INVITED") return "Invited a staff user";
  if (a === "DEALER_INVITED") return "Invited a dealer user";
  if (a === "ACCOUNT_ACTIVATED") return "Account activated";
  if (a === "STAFF_ROLE_TEMPLATE_CREATED") return name ? `Created role template: ${name}` : "Created role template";
  if (a === "STAFF_ROLE_TEMPLATE_UPDATED") return name ? `Updated role template: ${name}` : "Updated role template";
  if (a === "STAFF_ROLE_TEMPLATE_DELETED") return name ? `Deleted role template: ${name}` : "Deleted role template";
  if (a === "STAFF_SYSTEM_ROLE_PERMISSIONS_UPDATED") {
    const role = metaStr(meta, "role");
    return role ? `Updated system role permissions: ${role}` : "Updated system role permissions";
  }
  if (a === "DEALER_ORDER_SUBMITTED") return "Dealer order submitted";
  if (a === "ODOO_QUOTATION_CREATED") {
    return reference ? `Odoo quotation created (${reference})` : "Odoo quotation created";
  }
  if (a === "PFI_GENERATED") return "PFI document generated";
  if (a === "STATION_CREATED") return name ? `Created station: ${name}` : "Created station";
  if (a === "STATION_UPDATED") return name ? `Updated station: ${name}` : "Updated station";
  if (a === "STATION_PRICING_UPDATED") {
    return name ? `Updated station pricing: ${name}` : "Updated station pricing";
  }
  if (a === "STATION_DELETED") return name ? `Deleted station: ${name}` : "Deleted station";
  if (a === "TANK_CREATED") {
    const cap = meta.capacityLitres;
    const label = metaStr(meta, "label");
    if (label && typeof cap === "number") return `Created ${label} (Capacity: ${cap.toLocaleString()} L)`;
    return label ? `Created ${label}` : "Created tank";
  }
  if (a === "TANK_UPDATED") return metaStr(meta, "label") ? `Updated ${metaStr(meta, "label")}` : "Updated tank";
  if (a === "TANK_DELETED" || a === "TANK_DEACTIVATED") {
    const label = metaStr(meta, "label");
    return label ? `${a === "TANK_DEACTIVATED" ? "Deactivated" : "Deleted"} ${label}` : "Tank removed";
  }
  if (a === "TRUCK_CREATED") {
    const tn = metaStr(meta, "truckNumber");
    const st = metaStr(meta, "stationName");
    if (tn && st) return `Created ${tn} assigned to ${st}`;
    return tn ? `Created ${tn}` : "Created truck";
  }
  if (a === "TRUCK_UPDATED") return metaStr(meta, "truckNumber") ? `Updated ${metaStr(meta, "truckNumber")}` : "Updated truck";
  if (a === "TRUCK_STATUS_CHANGED") {
    const tn = metaStr(meta, "truckNumber");
    const status = metaStr(meta, "status");
    return tn && status ? `${tn} status → ${status}` : "Truck status changed";
  }
  if (a === "TRUCK_DELETED" || a === "TRUCK_DEACTIVATED") {
    const tn = metaStr(meta, "truckNumber");
    return tn ? `${a === "TRUCK_DEACTIVATED" ? "Deactivated" : "Deleted"} ${tn}` : "Truck removed";
  }
  if (action.toLowerCase() === "support.ticket.create") {
    return reference ? `Created support ticket ${reference}` : "Created support ticket";
  }
  if (action.toLowerCase() === "support.ticket.status") {
    const from = metaStr(meta, "from");
    const to = metaStr(meta, "to");
    if (from && to) return `Support ticket status ${from} → ${to}`;
    return "Updated support ticket status";
  }
  if (a === "PRESENTATION_CREATED") return name ? `Created presentation: ${name}` : "Created presentation";
  if (a === "GO_LIVE_CLEANUP") return "Go-live cleanup run";

  const human = action.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
  if (entity) return `${human} · ${entity}`;
  return human;
}

export function initials(firstName: string | null | undefined, lastName: string | null | undefined, email?: string | null) {
  const a = (firstName ?? "").trim().charAt(0);
  const b = (lastName ?? "").trim().charAt(0);
  const out = `${a}${b}`.toUpperCase();
  if (out) return out;
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function sanitizeMetaForDisplay(meta: Record<string, unknown>): Record<string, unknown> {
  const blocked = /password|token|secret|apikey|api_key|authorization|cookie|session/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.test(k)) {
      out[k] = "••••";
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}
