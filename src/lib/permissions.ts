/**
 * Staff permissions, Windows-style: a role gives default access per module (View / Act), and each
 * person may have Allow or Deny ticks on top (stored in User.permissions). Deny wins; Act needs View.
 * Client- and edge-safe: no database imports.
 *
 * App-module access (Dealer / Retail / Depot / Note Taker / Presentations) gates entire surfaces.
 * Tab permissions only apply when the parent app module is allowed.
 */
import {
  APP_MODULES,
  accessKeyForAppModule,
  appModuleIdForTab,
  type AppModuleId,
} from "@/lib/permissions/app-modules";

export type { AppModuleId } from "@/lib/permissions/app-modules";
export { APP_MODULES, appModuleById, accessKeyForAppModule } from "@/lib/permissions/app-modules";

/** Retail / admin tabs (legacy) + app-module access gates + portal-specific tabs. */
export type PermissionModule =
  | "analytics"
  | "orders"
  | "messaging"
  | "support"
  | "retailUsers"
  | "adminUsers"
  | "activity"
  | "settings"
  | "stockReporting"
  | "accessDealer"
  | "accessRetail"
  | "accessDepot"
  | "accessNoteTaker"
  | "accessPresentations"
  | "dealerDashboard"
  | "dealerOrders"
  | "dealerMessaging"
  | "dealerSupport"
  | "dealerStock"
  | "depotDashboard"
  | "noteSessions"
  | "noteNotes"
  | "presDecks"
  | "presPresent";

export type PermissionLevel = "view" | "act";
export type PermissionKey = `${PermissionModule}.${PermissionLevel}`;
export type StaffUser = { accountType?: string | null; role?: string | null; permissions?: string | null };

const ACCESS_KEYS = new Set<PermissionModule>([
  "accessDealer",
  "accessRetail",
  "accessDepot",
  "accessNoteTaker",
  "accessPresentations",
]);

/**
 * Flat matrix rows used by legacy admin dialogs — retail/admin tabs only.
 * Roles & Permissions UI uses APP_MODULES instead.
 */
export const PERMISSION_MODULES: {
  key: PermissionModule;
  label: string;
  levels: PermissionLevel[];
  portal: "staff" | "dealer" | "both" | "admin";
}[] = [
  { key: "orders", label: "Orders", levels: ["view", "act"], portal: "both" },
  { key: "analytics", label: "Analytics", levels: ["view", "act"], portal: "staff" },
  { key: "messaging", label: "Messages", levels: ["view", "act"], portal: "both" },
  { key: "support", label: "Support", levels: ["view", "act"], portal: "both" },
  { key: "retailUsers", label: "Users", levels: ["view", "act"], portal: "staff" },
  { key: "settings", label: "Settings", levels: ["view", "act"], portal: "staff" },
  { key: "stockReporting", label: "Stock Sale Reporting", levels: ["view", "act"], portal: "both" },
  { key: "adminUsers", label: "Admin", levels: ["view", "act"], portal: "admin" },
  { key: "activity", label: "Activity Logs", levels: ["view", "act"], portal: "admin" },
];

/** Every grantable key (access gates + all module tabs). */
export const PERMISSION_KEYS: PermissionKey[] = (() => {
  const keys: PermissionKey[] = [];
  for (const mod of APP_MODULES) {
    keys.push(`${mod.accessKey}.view` as PermissionKey, `${mod.accessKey}.act` as PermissionKey);
    for (const tab of mod.tabs) {
      for (const level of tab.levels) {
        keys.push(`${tab.key}.${level}` as PermissionKey);
      }
    }
  }
  return keys;
})();

/** WRITE implies READ — expand act keys so view is always present. */
export function normalizePermissionKeys(keys: readonly string[]): PermissionKey[] {
  const set = new Set<PermissionKey>();
  for (const key of keys) {
    if (!PERMISSION_KEYS.includes(key as PermissionKey)) continue;
    set.add(key as PermissionKey);
    if (key.endsWith(".act")) {
      const view = key.replace(/\.act$/, ".view") as PermissionKey;
      if (PERMISSION_KEYS.includes(view)) set.add(view);
    }
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

const RETAIL_TAB_DEFAULTS: PermissionKey[] = [
  "analytics.view",
  "analytics.act",
  "orders.view",
  "orders.act",
  "messaging.view",
  "messaging.act",
  "support.view",
  "support.act",
  "stockReporting.view",
  "stockReporting.act",
];

const NOTE_PRES_DEFAULTS: PermissionKey[] = [
  "accessNoteTaker.view",
  "accessNoteTaker.act",
  "noteSessions.view",
  "noteSessions.act",
  "noteNotes.view",
  "noteNotes.act",
  "accessPresentations.view",
  "accessPresentations.act",
  "presDecks.view",
  "presDecks.act",
  "presPresent.view",
  "presPresent.act",
];

const ROLE_DEFAULTS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  SALES_PERSON_EXECUTIVE: [
    "accessRetail.view",
    "accessRetail.act",
    ...RETAIL_TAB_DEFAULTS,
    ...NOTE_PRES_DEFAULTS,
  ],
  /** Preserve prior open Note Taker / Presentations for all INTERNAL staff. */
  STANDARD_USER: [...NOTE_PRES_DEFAULTS],
};

/** Built-in role matrix (before SystemSetting overrides applied to users). */
export function codeRoleDefaultKeys(role: string | null | undefined): PermissionKey[] {
  if (!role || !ROLE_DEFAULTS[role]) return [];
  return [...ROLE_DEFAULTS[role]];
}

export function roleGrants(role: string | null | undefined, key: PermissionKey): boolean {
  return Boolean(role && ROLE_DEFAULTS[role]?.includes(key));
}

/**
 * Allow/Deny ticks that make `canUser` match `desired` for a person on this role,
 * relative to the built-in ROLE_DEFAULTS baseline.
 */
export function overridesForDesiredMatrix(
  role: string,
  desired: readonly PermissionKey[],
): Partial<Record<PermissionKey, "allow" | "deny">> {
  const want = new Set(desired);
  const out: Partial<Record<PermissionKey, "allow" | "deny">> = {};
  for (const key of PERMISSION_KEYS) {
    const inDefault = ROLE_DEFAULTS[role]?.includes(key) ?? false;
    const shouldHave = want.has(key);
    if (shouldHave && !inDefault) out[key] = "allow";
    else if (!shouldHave && inDefault) out[key] = "deny";
  }
  return out;
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

function rawGrants(user: StaffUser, module: PermissionModule, level: PermissionLevel): boolean {
  if (!PERMISSION_KEYS.includes(`${module}.${level}`)) return false;
  if (!grants(user, `${module}.view`)) return false;
  return level === "view" || grants(user, `${module}.act`);
}

/** Whether the role may open an application module (independent of tab ticks). */
export function canAccessAppModule(user: StaffUser | null | undefined, moduleId: AppModuleId): boolean {
  if (!user || user.accountType !== "INTERNAL") return false;
  return rawGrants(user, accessKeyForAppModule(moduleId), "view");
}

/**
 * Whether a staff member may view or act on a permission module/tab: parent app-module access
 * (when applicable), then role default, then Allow, then Deny (wins).
 */
export function canUser(user: StaffUser | null | undefined, module: PermissionModule, level: PermissionLevel): boolean {
  if (!user || user.accountType !== "INTERNAL") return false;
  if (!PERMISSION_KEYS.includes(`${module}.${level}`)) return false;

  if (!ACCESS_KEYS.has(module)) {
    const parent = appModuleIdForTab(module);
    if (parent && !canAccessAppModule(user, parent)) return false;
  }

  return rawGrants(user, module, level);
}

/** The Retail Interface opens when Retail module access is on and at least one retail tab is viewable. */
export function canAccessRetail(user: StaffUser | null | undefined): boolean {
  if (!canAccessAppModule(user, "retail")) return false;
  return (["analytics", "orders", "messaging", "support", "retailUsers", "stockReporting"] as const).some((m) =>
    canUser(user, m, "view"),
  );
}

/** Count of app modules with access enabled for a permission key list (Roles sidebar). */
export function countEnabledAppModules(keys: readonly PermissionKey[]): number {
  const set = new Set(keys);
  return APP_MODULES.filter((m) => set.has(`${m.accessKey}.view` as PermissionKey)).length;
}

/**
 * Migrate a legacy flat key list (pre app-module access) into a complete matrix:
 * - Infer accessRetail when any retail tab is present
 * - Preserve note/pres open access for roles that had no explicit denial path (added via ROLE_DEFAULTS at runtime)
 */
export function migratePermissionKeys(keys: readonly string[]): PermissionKey[] {
  const normalized = normalizePermissionKeys(keys);
  const set = new Set<PermissionKey>(normalized);

  const retailTabs = APP_MODULES.find((m) => m.id === "retail")!.tabs.map((t) => t.key);
  const hasRetailTab = retailTabs.some((t) => set.has(`${t}.view` as PermissionKey) || set.has(`${t}.act` as PermissionKey));
  if (hasRetailTab) {
    set.add("accessRetail.view");
    set.add("accessRetail.act");
  }

  return PERMISSION_KEYS.filter((k) => set.has(k));
}
