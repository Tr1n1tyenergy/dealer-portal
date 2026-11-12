"use client";

import {
  APP_MODULES,
  type AppModuleId,
  type PermissionKey,
  type PermissionModule,
} from "@/lib/permissions";
import {
  Activity,
  BarChart3,
  Check,
  ClipboardList,
  Copy,
  Eye,
  Fuel,
  Info,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Mic,
  Pencil,
  Presentation,
  Settings,
  Shield,
  Store,
  Trash2,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

type RoleItem = {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystem: boolean;
};

type Props = {
  role: RoleItem;
  draftPerms: PermissionKey[];
  selectedModuleId: AppModuleId;
  canEdit: boolean;
  canActRetailUsers: boolean;
  busy: boolean;
  permsDirty: boolean;
  onSelectModule: (id: AppModuleId) => void;
  onToggleModuleAccess: (on: boolean) => void;
  onToggleTab: (tabKey: PermissionModule, level: "view" | "act", on: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDuplicate: () => void;
  onEditRole?: () => void;
  onDeleteRole?: () => void;
};

function moduleCardIcon(id: AppModuleId) {
  const props = { size: 20, strokeWidth: 1.6 } as const;
  switch (id) {
    case "dealer":
      return <Store {...props} />;
    case "retail":
      return <BarChart3 {...props} />;
    case "depot":
      return <Warehouse {...props} />;
    case "noteTaker":
      return <Mic {...props} />;
    case "presentations":
      return <Presentation {...props} />;
    default:
      return <Shield {...props} />;
  }
}

function tabIcon(key: PermissionModule) {
  const props = { size: 15, strokeWidth: 1.5, className: "ru-perm-module__svg" } as const;
  switch (key) {
    case "orders":
    case "dealerOrders":
      return <ClipboardList {...props} />;
    case "analytics":
      return <BarChart3 {...props} />;
    case "messaging":
    case "dealerMessaging":
      return <MessageSquare {...props} />;
    case "support":
    case "dealerSupport":
      return <Mail {...props} />;
    case "retailUsers":
      return <Users {...props} />;
    case "settings":
      return <Settings {...props} />;
    case "stockReporting":
    case "dealerStock":
      return <Fuel {...props} />;
    case "adminUsers":
      return <Shield {...props} />;
    case "activity":
      return <Activity {...props} />;
    case "dealerDashboard":
    case "depotDashboard":
      return <LayoutDashboard {...props} />;
    case "noteSessions":
    case "noteNotes":
      return <Mic {...props} />;
    case "presDecks":
    case "presPresent":
      return <Presentation {...props} />;
    default:
      return <Truck {...props} />;
  }
}

export function RolePermissionsPanel({
  role,
  draftPerms,
  selectedModuleId,
  canEdit,
  canActRetailUsers,
  busy,
  permsDirty,
  onSelectModule,
  onToggleModuleAccess,
  onToggleTab,
  onSave,
  onDiscard,
  onDuplicate,
  onEditRole,
  onDeleteRole,
}: Props) {
  const appMod = APP_MODULES.find((m) => m.id === selectedModuleId) ?? APP_MODULES[0];
  const accessView = `${appMod.accessKey}.view` as PermissionKey;
  const moduleAllowed = draftPerms.includes(accessView);
  const matrixLocked = !canEdit || !moduleAllowed;

  return (
    <>
      <div className="ru-roles__main-head">
        <div className="ru-roles__main-title">
          <span className="ru-roles__main-icon" aria-hidden>
            <Shield size={18} strokeWidth={1.75} />
          </span>
          <div className="ru-roles__main-copy">
            <h3>
              {role.name} <span className="ru-badge">Active</span>
            </h3>
            <p className="ru-roles__main-sub">Manage the permissions for this role.</p>
          </div>
        </div>
        <div className="ru-roles__actions">
          {canActRetailUsers ? (
            <>
              <button type="button" className="ru-btn ru-btn--ghost" onClick={onDuplicate} disabled={busy}>
                <Copy size={14} strokeWidth={1.75} />
                Duplicate
              </button>
              {!role.isSystem && onEditRole ? (
                <button type="button" className="ru-btn ru-btn--ghost" onClick={onEditRole}>
                  <Pencil size={14} strokeWidth={1.75} />
                  Edit Role
                </button>
              ) : null}
              {!role.isSystem && onDeleteRole ? (
                <button type="button" className="ru-btn ru-btn--danger" onClick={onDeleteRole} disabled={busy}>
                  <Trash2 size={14} strokeWidth={1.75} />
                  Delete
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="ru-info ru-info--roles">
        <Info size={15} strokeWidth={1.75} />
        <span>
          {role.isSystem
            ? "Editing a system role updates every active staff member on this role. Duplicate it to keep a separate invite template."
            : "Editing a role updates every staff member assigned to it. Duplicate it to create a separate template."}
        </span>
      </div>

      <div className="ru-modsel">
        <div className="ru-modsel__head">
          <strong>Select Module</strong>
          <span>Choose a module to configure access and permissions.</span>
        </div>
        <div className="ru-modsel__grid" role="listbox" aria-label="Application modules">
          {APP_MODULES.map((mod) => {
            const selected = mod.id === selectedModuleId;
            const allowed = draftPerms.includes(`${mod.accessKey}.view` as PermissionKey);
            return (
              <button
                key={mod.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`ru-modcard ${selected ? "is-selected" : ""} ${allowed ? "is-allowed" : ""}`}
                onClick={() => onSelectModule(mod.id)}
              >
                <span className="ru-modcard__icon" aria-hidden>
                  {moduleCardIcon(mod.id)}
                </span>
                <span className="ru-modcard__label">{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`ru-modaccess ${moduleAllowed ? "is-on" : "is-off"}`}>
        <div className="ru-modaccess__left">
          <span className="ru-modaccess__icon" aria-hidden>
            {moduleCardIcon(appMod.id)}
          </span>
          <div>
            <strong>{appMod.label}</strong>
            <span>{appMod.accessHint}</span>
          </div>
        </div>
        <label className="ru-switch">
          <span className="ru-switch__text">Allow access to this module</span>
          <input
            type="checkbox"
            checked={moduleAllowed}
            disabled={!canEdit}
            onChange={(e) => onToggleModuleAccess(e.target.checked)}
            aria-label={`Allow access to ${appMod.label}`}
          />
          <span className="ru-switch__track" aria-hidden />
        </label>
      </div>

      {!moduleAllowed ? (
        <div className="ru-mod-restricted" role="status">
          <Info size={14} strokeWidth={1.75} />
          <span>
            This module is restricted for this role. Tab permissions are preserved but inactive until
            access is re-enabled.
          </span>
        </div>
      ) : null}

      <div className={`ru-perm-wrap ${matrixLocked ? "is-disabled" : ""}`}>
        <table className="ru-perm-table">
          <colgroup>
            <col className="ru-perm-col" />
            <col className="ru-perm-col" />
            <col className="ru-perm-col" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <span className="ru-perm-th">
                  <Info size={13} strokeWidth={1.75} aria-hidden />
                  Navigation Tab
                </span>
              </th>
              <th>
                <span className="ru-perm-th ru-perm-th--center">
                  <Eye size={13} strokeWidth={1.75} aria-hidden />
                  Read (View only)
                </span>
              </th>
              <th>
                <span className="ru-perm-th ru-perm-th--center">
                  <Pencil size={13} strokeWidth={1.75} aria-hidden />
                  Write (View &amp; edit)
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {appMod.tabs.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="ru-empty" style={{ padding: "1rem" }}>
                    <strong>No navigation tabs</strong>
                    <p>This module has no configurable tabs yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              appMod.tabs.map((tab) => {
                const viewKey = `${tab.key}.view` as PermissionKey;
                const actKey = `${tab.key}.act` as PermissionKey;
                const hasView = draftPerms.includes(viewKey);
                const hasAct = tab.levels.includes("act") && draftPerms.includes(actKey);
                const canWrite = tab.levels.includes("act");
                return (
                  <tr key={tab.key}>
                    <td>
                      <div className="ru-perm-module ru-perm-module--row">
                        <span className="ru-perm-module__icon" aria-hidden>
                          {tabIcon(tab.key)}
                        </span>
                        <div>
                          <strong>{tab.label}</strong>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`ru-perm-check ru-perm-check--center ${hasView ? "is-on" : ""}`}
                        aria-label={`${tab.label} read`}
                        aria-pressed={hasView}
                        disabled={matrixLocked}
                        onClick={() => onToggleTab(tab.key, "view", !hasView)}
                      >
                        {hasView ? <Check size={11} strokeWidth={3} /> : null}
                      </button>
                    </td>
                    <td>
                      {canWrite ? (
                        <button
                          type="button"
                          className={`ru-perm-check ru-perm-check--center ${hasAct ? "is-on" : ""}`}
                          aria-label={`${tab.label} write`}
                          aria-pressed={hasAct}
                          disabled={matrixLocked}
                          onClick={() => onToggleTab(tab.key, "act", !hasAct)}
                        >
                          {hasAct ? <Check size={11} strokeWidth={3} /> : null}
                        </button>
                      ) : (
                        <span className="ru-perm-na">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {permsDirty ? (
        <div className="ru-form__foot" style={{ marginTop: "0.85rem" }}>
          <button type="button" className="ru-btn ru-btn--ghost" onClick={onDiscard} disabled={busy}>
            Discard
          </button>
          <button type="button" className="ru-btn ru-btn--gold" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save permissions"}
          </button>
        </div>
      ) : null}
    </>
  );
}
