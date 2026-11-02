/**
 * Staff permissions, Windows-style: a role gives default access per module (View / Act), and each
 * person may have Allow or Deny ticks on top (stored in User.permissions). Deny wins; Act needs View.
 * Client- and edge-safe: no database imports.
 */
export type PermissionModule = "analytics" | "orders" | "messaging" | "retailUsers" | "adminUsers" | "activity" | "settings";
export type PermissionLevel = "view" | "act";
export type PermissionKey = `${PermissionModule}.${PermissionLevel}`;
export type StaffUser = { accountType?: string | null; role?: string | null; permissions?: string | null };

export const PERMISSION_MODULES: { key: PermissionModule; label: string; levels: PermissionLevel[] }[] = [
  { key: "analytics", label: "Retail Analytics", levels: ["view"] },
  { key: "orders", label: "Orders", levels: ["view", "act"] },
  { key: "messaging", label: "Messaging", levels: ["view", "act"] },
  { key: "retailUsers", label: "Retail Users", levels: ["view", "act"] },
  { key: "adminUsers", label: "Admin Users", levels: ["view", "act"] },
  { key: "activity", label: "Activity Logs", levels: ["view"] },
  { key: "settings", label: "Settings", levels: ["view"] },
];

export const PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => m.levels.map((l) => `${m.key}.${l}` as PermissionKey));

const ROLE_DEFAULTS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  SALES_PERSON_EXECUTIVE: ["analytics.view", "orders.view", "orders.act", "messaging.view", "messaging.act"],
};

export function roleGrants(role: string | null | undefined, key: PermissionKey): boolean {
  return Boolean(role && ROLE_DEFAULTS[role]?.includes(key));
}

/** The person's Allow/Deny ticks. Old values ("[]", lists) and anything malformed mean none. */
export function parseOverrides(raw: string | null | undefined): Partial<Record<PermissionKey, "allow" | "deny">> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "");
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Partial<Record<PermissionKey, "allow" | "deny">> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (PERMISSION_KEYS.includes(key as PermissionKey) && (value === "allow" || value === "deny")) {
      out[key as PermissionKey] = value;
    }
  }
  return out;
}

function grants(user: StaffUser, key: PermissionKey): boolean {
  const tick = parseOverrides(user.permissions)[key];
  if (tick === "deny") return false;
  return tick === "allow" || roleGrants(user.role, key);
}

/** Whether a staff member may view or act on a module: role default, then Allow, then Deny (wins). */
export function canUser(user: StaffUser | null | undefined, module: PermissionModule, level: PermissionLevel): boolean {
  if (!user || user.accountType !== "INTERNAL") return false;
  if (!PERMISSION_KEYS.includes(`${module}.${level}`)) return false;
  if (!grants(user, `${module}.view`)) return false;
  return level === "view" || grants(user, `${module}.act`);
}

/** The Retail Interface opens for anyone who can view one of its areas. */
export function canAccessRetail(user: StaffUser | null | undefined): boolean {
  return (["analytics", "orders", "messaging", "retailUsers"] as const).some((m) => canUser(user, m, "view"));
}
