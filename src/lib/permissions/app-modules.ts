/**
 * Five application modules for Roles & Permissions (mockup Attachment 2).
 * Tab keys map to PermissionModule values in permissions.ts.
 */
import type { PermissionModule } from "@/lib/permissions";

export type AppModuleId = "dealer" | "retail" | "depot" | "noteTaker" | "presentations";

export type AppModuleTab = {
  /** PermissionModule key used for Read/Write ticks */
  key: PermissionModule;
  label: string;
  levels: Array<"view" | "act">;
};

export type AppModuleDef = {
  id: AppModuleId;
  label: string;
  /** Short line under Module Access */
  accessHint: string;
  /** Module-level access PermissionModule (view = allowed) */
  accessKey: PermissionModule;
  tabs: AppModuleTab[];
};

export const APP_MODULES: AppModuleDef[] = [
  {
    id: "dealer",
    label: "Dealer Portal",
    accessHint: "Restrict or allow access to the entire Dealer Portal for this role.",
    accessKey: "accessDealer",
    tabs: [
      { key: "dealerDashboard", label: "Dashboard", levels: ["view", "act"] },
      { key: "dealerOrders", label: "Orders", levels: ["view", "act"] },
      { key: "dealerMessaging", label: "Messages", levels: ["view", "act"] },
      { key: "dealerSupport", label: "Support", levels: ["view", "act"] },
      { key: "dealerStock", label: "Stock Sale Reporting", levels: ["view", "act"] },
    ],
  },
  {
    id: "retail",
    label: "Retail Module",
    accessHint: "Restrict or allow access to the entire Retail Module for this role.",
    accessKey: "accessRetail",
    tabs: [
      { key: "orders", label: "Orders", levels: ["view", "act"] },
      { key: "analytics", label: "Analytics", levels: ["view", "act"] },
      { key: "messaging", label: "Messages", levels: ["view", "act"] },
      { key: "support", label: "Support", levels: ["view", "act"] },
      { key: "retailUsers", label: "Users", levels: ["view", "act"] },
      { key: "settings", label: "Settings", levels: ["view", "act"] },
      { key: "stockReporting", label: "Stock Sale Reporting", levels: ["view", "act"] },
      { key: "adminUsers", label: "Admin", levels: ["view", "act"] },
      { key: "activity", label: "Activity Logs", levels: ["view", "act"] },
    ],
  },
  {
    id: "depot",
    label: "Depot Portal",
    accessHint: "Restrict or allow access to the entire Depot Portal for this role.",
    accessKey: "accessDepot",
    tabs: [{ key: "depotDashboard", label: "Operations Dashboard", levels: ["view", "act"] }],
  },
  {
    id: "noteTaker",
    label: "Note Taker Module",
    accessHint: "Restrict or allow access to the entire Note Taker Module for this role.",
    accessKey: "accessNoteTaker",
    tabs: [
      { key: "noteSessions", label: "Sessions", levels: ["view", "act"] },
      { key: "noteNotes", label: "Session Notes", levels: ["view", "act"] },
    ],
  },
  {
    id: "presentations",
    label: "Presentation Module",
    accessHint: "Restrict or allow access to the entire Presentation Module for this role.",
    accessKey: "accessPresentations",
    tabs: [
      { key: "presDecks", label: "Decks", levels: ["view", "act"] },
      { key: "presPresent", label: "Present Mode", levels: ["view", "act"] },
    ],
  },
];

export function appModuleById(id: AppModuleId): AppModuleDef {
  const mod = APP_MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Unknown app module: ${id}`);
  return mod;
}

/** Which app module owns a permission tab (not access.* keys). */
export function appModuleIdForTab(tab: PermissionModule): AppModuleId | null {
  for (const mod of APP_MODULES) {
    if (mod.tabs.some((t) => t.key === tab)) return mod.id;
  }
  return null;
}

export function accessKeyForAppModule(id: AppModuleId): PermissionModule {
  return appModuleById(id).accessKey;
}
