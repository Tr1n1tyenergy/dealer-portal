"use client";

import {
  canUser,
  type AppModuleId,
  type PermissionKey,
  type PermissionModule,
} from "@/lib/permissions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Check,
  Clock3,
  Crown,
  Filter,
  Info,
  Mail,
  MoreVertical,
  Pencil,
  Search,
  Send,
  Shield,
  Store,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  isProtectedSuperAdminEmail,
  mayDeleteProtectedAdmin,
} from "@/lib/security/protected-admins";
import "@/app/intelligence/retail/retail-users.css";
import { checkStationSelection } from "@/lib/dealers/station-selection";
import { roleLabel, STAFF_ROLES, type StaffRole } from "@/lib/access";
import { matchesUserQuery } from "@/lib/users/user-search";
import { StationMultiSelect } from "@/components/retail/station-multi-select";
import { CreateRoleModal } from "@/components/retail/create-role-modal";
import { RolePermissionsPanel } from "@/components/retail/role-permissions-panel";

type StationOpt = {
  stationCode: string;
  stationName: string;
  tradingName: string;
  orgCode: string;
  orgName: string;
  invitable: boolean;
  hasLogin: boolean;
  loginEmail: string | null;
};

type RetailUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountType: string;
  status: string;
  department: string;
  createdAt: string;
  lastLoginAt: string | null;
  dealerOrganization?: {
    name: string;
    code: string;
    stations: { name: string; tradingName: string | null; code: string | null }[];
  } | null;
};

type RoleItem = {
  id: string;
  kind: "system" | "template";
  name: string;
  description: string;
  permissions: PermissionKey[];
  moduleCount: number;
  baseRole: StaffRole;
  systemRole?: StaffRole;
  isSystem: boolean;
  status: "active";
};

type TypeFilter = "ALL" | "DEALER" | "INTERNAL";
type TabKey = "active" | "pending" | "roles";

type EditForm = {
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  status: "PENDING" | "ACTIVE" | "DISABLED";
};

const PAGE_SIZE = 10;
const DEPARTMENTS = ["Operations", "Finance", "Sales", "Customer Service", "IT", "Management"];
function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function orgLabel(u: RetailUser) {
  if (u.accountType === "INTERNAL") {
    return u.department?.trim() || "Head Office";
  }
  const stations = u.dealerOrganization?.stations ?? [];
  const stationNames = stations
    .map((s) => s.tradingName || s.name)
    .filter(Boolean)
    .slice(0, 3);
  if (u.dealerOrganization?.name && stationNames.length) {
    return `${u.dealerOrganization.name} — ${stationNames.join(", ")}`;
  }
  return (
    stationNames[0] ||
    u.dealerOrganization?.name ||
    "—"
  );
}

function matchesQuery(u: RetailUser, q: string) {
  return matchesUserQuery({ ...u, organization: orgLabel(u) }, q);
}

export function RetailUsersClient() {
  const { data: session } = useSession();
  const canManageUsers = canUser(session?.user, "adminUsers", "act");
  const canActRetailUsers = canUser(session?.user, "retailUsers", "act");
  /** Admins (or Users managers) may edit custom role permission matrices. */
  const canEditRolePerms = canActRetailUsers || canManageUsers;

  const [stations, setStations] = useState<StationOpt[]>([]);
  const [users, setUsers] = useState<RetailUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [stationCodes, setStationCodes] = useState<string[]>([]);
  const [dealerEmail, setDealerEmail] = useState("");
  const [dealerFirst, setDealerFirst] = useState("");
  const [dealerLast, setDealerLast] = useState("");

  const [staffEmail, setStaffEmail] = useState("");
  const [staffFirst, setStaffFirst] = useState("");
  const [staffLast, setStaffLast] = useState("");
  const [staffDept, setStaffDept] = useState("Operations");
  const [staffRoleKey, setStaffRoleKey] = useState("system:STANDARD_USER");

  const [tab, setTab] = useState<TabKey>("roles");
  const [pendingQuery, setPendingQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [pendingType, setPendingType] = useState<TypeFilter>("ALL");
  const [activePage, setActivePage] = useState(0);
  const [pendingPage, setPendingPage] = useState(0);

  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RetailUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [roleQuery, setRoleQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("system:STANDARD_USER");
  const [draftPerms, setDraftPerms] = useState<PermissionKey[]>([]);
  const [selectedAppModule, setSelectedAppModule] = useState<AppModuleId>("retail");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDesc, setEditRoleDesc] = useState("");

  const load = useCallback(async () => {
    const [sRes, uRes, rRes] = await Promise.all([
      fetch("/api/retail/stations"),
      fetch("/api/retail/users"),
      fetch("/api/retail/roles"),
    ]);
    if (sRes.ok) {
      const data = await sRes.json();
      setStations(data.stations ?? []);
    }
    if (uRes.ok) {
      const data = await uRes.json();
      setUsers(data.users ?? []);
    }
    if (rRes.ok) {
      const data = await rRes.json();
      const nextRoles = (data.roles ?? []) as RoleItem[];
      setRoles(nextRoles);
      setSelectedRoleId((cur) => {
        if (nextRoles.some((r) => r.id === cur)) return cur;
        return nextRoles[0]?.id ?? "system:STANDARD_USER";
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menuUserId) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuUserId(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuUserId]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (!selectedRole) return;
    setDraftPerms(selectedRole.permissions);
  }, [selectedRole]);

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [roles, roleQuery]);

  function openEdit(u: RetailUser) {
    setMenuUserId(null);
    setEditing(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      department: u.department || "Operations",
      role: u.role,
      status: (u.status as EditForm["status"]) || "ACTIVE",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm) return;
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch(`/api/retail/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        department: editing.accountType === "INTERNAL" ? editForm.department : undefined,
        role: editForm.role,
        status: editForm.status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update user");
      return;
    }
    setOk(`Updated ${editForm.firstName} ${editForm.lastName}.`);
    setEditing(null);
    setEditForm(null);
    await load();
  }

  async function deleteUser(u: RetailUser) {
    setMenuUserId(null);
    if (
      !confirm(
        `Delete ${u.firstName} ${u.lastName} (${u.email})?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch(`/api/retail/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not delete user");
      return;
    }
    setOk(`Deleted ${u.firstName} ${u.lastName}.`);
    await load();
  }

  async function resendInvitation(u: RetailUser) {
    setMenuUserId(null);
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetInvite: true }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not resend invitation");
      return;
    }
    setOk(`Invitation resent to ${u.email}.`);
    await load();
  }

  async function revokeInvitation(u: RetailUser) {
    setMenuUserId(null);
    if (!confirm(`Revoke invitation for ${u.email}? The pending account will be deleted.`)) return;
    await deleteUser(u);
  }

  function renderActions(u: RetailUser) {
    if (!canManageUsers) {
      return (
        <button type="button" className="ru-actions" aria-label="More actions" disabled title="Admin only">
          <MoreVertical size={16} />
        </button>
      );
    }
    const open = menuUserId === u.id;
    const actorEmail = session?.user?.email ?? "";
    const canDelete = mayDeleteProtectedAdmin(actorEmail, u.email);
    const protectedTarget = isProtectedSuperAdminEmail(u.email);
    const pending = u.status === "PENDING";
    return (
      <div className="ru-menu" ref={open ? menuRef : undefined}>
        <button
          type="button"
          className={`ru-actions ${open ? "is-open" : ""}`}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setMenuUserId(open ? null : u.id)}
        >
          <MoreVertical size={16} />
        </button>
        {open ? (
          <div className="ru-menu__panel" role="menu">
            <button type="button" role="menuitem" onClick={() => openEdit(u)}>
              <Pencil size={14} strokeWidth={1.75} />
              Edit user
            </button>
            {pending ? (
              <button type="button" role="menuitem" onClick={() => void resendInvitation(u)}>
                <Mail size={14} strokeWidth={1.75} />
                Resend invite
              </button>
            ) : null}
            {pending ? (
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => void revokeInvitation(u)}
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Revoke invite
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                disabled={!canDelete}
                title={
                  !canDelete && protectedTarget
                    ? "Only admin@trinityenergyltd.com can delete this Admin"
                    : undefined
                }
                onClick={() => {
                  if (!canDelete) return;
                  void deleteUser(u);
                }}
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Delete user
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  async function inviteDealer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch("/api/retail/invite/dealer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationCodes,
        email: dealerEmail,
        firstName: dealerFirst,
        lastName: dealerLast,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Dealer invite failed");
      return;
    }
    setOk(`Dealer invite sent to ${dealerEmail}.`);
    setStationCodes([]);
    setDealerEmail("");
    setDealerFirst("");
    setDealerLast("");
    setTab("pending");
    await load();
  }

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const isTemplate = !staffRoleKey.startsWith("system:");
    const body = isTemplate
      ? {
          email: staffEmail,
          firstName: staffFirst,
          lastName: staffLast,
          department: staffDept,
          roleTemplateId: staffRoleKey,
        }
      : {
          email: staffEmail,
          firstName: staffFirst,
          lastName: staffLast,
          department: staffDept,
          role: staffRoleKey.replace("system:", "") as StaffRole,
        };
    const res = await fetch("/api/retail/invite/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Staff invite failed");
      return;
    }
    setOk(`Staff invite sent to ${staffEmail}.`);
    setStaffEmail("");
    setStaffFirst("");
    setStaffLast("");
    setTab("pending");
    await load();
  }

  async function createRole(input: { name: string; description: string }) {
    setCreateError("");
    setBusy(true);
    const res = await fetch("/api/retail/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description || null,
        permissions: [],
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setCreateError(typeof data.error === "string" ? data.error : "Could not create role");
      return;
    }
    setCreateOpen(false);
    setOk(`Created role “${data.role?.name ?? input.name}”. Assign permissions below.`);
    setTab("roles");
    await load();
    if (data.role?.id) setSelectedRoleId(data.role.id);
  }

  async function saveRolePermissions() {
    if (!selectedRole || !canEditRolePerms) return;
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch(`/api/retail/roles/${encodeURIComponent(selectedRole.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: draftPerms }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save permissions");
      return;
    }
    setOk(
      selectedRole.isSystem
        ? `Permissions saved for ${selectedRole.name}. Active staff on this role are updated.`
        : `Permissions saved for ${selectedRole.name}.`,
    );
    await load();
  }

  async function duplicateRole() {
    if (!selectedRole) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/retail/roles/${selectedRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicate: true }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not duplicate role");
      return;
    }
    setOk(`Duplicated as “${data.role?.name ?? "copy"}”.`);
    await load();
    if (data.role?.id) setSelectedRoleId(data.role.id);
  }

  async function deleteRole() {
    if (!selectedRole || selectedRole.isSystem) return;
    if (!confirm(`Delete role “${selectedRole.name}”? Existing users keep their current permissions.`)) {
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/retail/roles/${selectedRole.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not delete role");
      return;
    }
    setOk(`Deleted role “${selectedRole.name}”.`);
    setSelectedRoleId("system:STANDARD_USER");
    await load();
  }

  async function saveRoleMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole || selectedRole.isSystem) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/retail/roles/${selectedRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editRoleName.trim(),
        description: editRoleDesc.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update role");
      return;
    }
    setEditRoleOpen(false);
    setOk(`Updated role “${data.role?.name ?? editRoleName}”.`);
    await load();
  }

  function togglePerm(moduleKey: PermissionModule, level: "view" | "act", on: boolean) {
    if (!selectedRole || !canEditRolePerms) return;
    setDraftPerms((prev) => {
      const viewKey = `${moduleKey}.view` as PermissionKey;
      const actKey = `${moduleKey}.act` as PermissionKey;
      const set = new Set(prev);
      if (level === "view") {
        if (on) set.add(viewKey);
        else {
          set.delete(viewKey);
          set.delete(actKey);
        }
      } else if (on) {
        set.add(viewKey);
        set.add(actKey);
      } else {
        set.delete(actKey);
      }
      return Array.from(set) as PermissionKey[];
    });
  }

  function toggleModuleAccess(on: boolean) {
    if (!selectedRole || !canEditRolePerms) return;
    const accessMap: Record<AppModuleId, PermissionModule> = {
      dealer: "accessDealer",
      retail: "accessRetail",
      depot: "accessDepot",
      noteTaker: "accessNoteTaker",
      presentations: "accessPresentations",
    };
    const accessKey = accessMap[selectedAppModule];
    setDraftPerms((prev) => {
      const viewKey = `${accessKey}.view` as PermissionKey;
      const actKey = `${accessKey}.act` as PermissionKey;
      const set = new Set(prev);
      if (on) {
        set.add(viewKey);
        set.add(actKey);
      } else {
        set.delete(viewKey);
        set.delete(actKey);
      }
      return Array.from(set) as PermissionKey[];
    });
  }

  const selection = stationCodes.length ? checkStationSelection(stations, stationCodes) : null;
  const pendingAll = users.filter((u) => u.status === "PENDING");
  const activeAll = users.filter((u) => u.status === "ACTIVE");

  const pending = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase();
    return pendingAll.filter((u) => {
      if (pendingType !== "ALL" && u.accountType !== pendingType) return false;
      return matchesQuery(u, q);
    });
  }, [pendingAll, pendingQuery, pendingType]);

  const active = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    return activeAll.filter((u) => {
      if (typeFilter !== "ALL" && u.accountType !== typeFilter) return false;
      return matchesQuery(u, q);
    });
  }, [activeAll, activeQuery, typeFilter]);

  const activePages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const pendingPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const activeSlice = active.slice(activePage * PAGE_SIZE, activePage * PAGE_SIZE + PAGE_SIZE);
  const pendingSlice = pending.slice(pendingPage * PAGE_SIZE, pendingPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setActivePage(0);
  }, [activeQuery, typeFilter]);

  useEffect(() => {
    setPendingPage(0);
  }, [pendingQuery, pendingType]);

  const permsDirty = Boolean(
    selectedRole &&
      canEditRolePerms &&
      JSON.stringify([...draftPerms].sort()) !== JSON.stringify([...selectedRole.permissions].sort()),
  );

  return (
    <div className="ru">
      <header className="ru-hero" aria-label="Users hero">
        <div className="ru-hero__text">
          <div className="ru-hero__eyebrow">Staff Portal</div>
          <h1>Users</h1>
          <p>
            Manage access to the Trinity platform. Invite dealers and internal staff, and monitor
            user status.
          </p>
        </div>
      </header>

      <div className="ru-wrap">
        {error ? <div className="ru-flash ru-flash--error">{error}</div> : null}
        {ok ? <div className="ru-flash ru-flash--ok">{ok}</div> : null}

        <div className="ru-invites">
          <article className="ru-card" id="invite-dealer">
            <div className="ru-card__inner">
              <div className="ru-card__head">
                <span className="ru-card__icon ru-card__icon--gold">
                  <Store size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <h2>Invite Dealer</h2>
                  <p>Send an invitation to a dealer for one or more of their stations.</p>
                </div>
              </div>

              <form onSubmit={inviteDealer} className="ru-form">
                <div className="ru-form__row ru-form__row--4">
                  <div className="ru-field">
                    <label htmlFor="station">Station</label>
                    <StationMultiSelect
                      id="station"
                      stations={stations}
                      value={stationCodes}
                      onChange={setStationCodes}
                    />
                  </div>
                  <div className="ru-field">
                    <label htmlFor="d-email">Email Address</label>
                    <div className="ru-field__control">
                      <Mail size={15} strokeWidth={1.75} />
                      <input
                        id="d-email"
                        type="email"
                        required
                        placeholder="dealer@company.com"
                        value={dealerEmail}
                        onChange={(e) => setDealerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ru-field">
                    <label htmlFor="d-first">First Name</label>
                    <div className="ru-field__control">
                      <UserRound size={15} strokeWidth={1.75} />
                      <input
                        id="d-first"
                        required
                        placeholder="First name"
                        value={dealerFirst}
                        onChange={(e) => setDealerFirst(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ru-field">
                    <label htmlFor="d-last">Last Name</label>
                    <div className="ru-field__control">
                      <UserRound size={15} strokeWidth={1.75} />
                      <input
                        id="d-last"
                        required
                        placeholder="Last name"
                        value={dealerLast}
                        onChange={(e) => setDealerLast(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {selection ? (
                  selection.ok ? (
                    <div className="ru-selection" role="status">
                      <span className="ru-selection__icon" aria-hidden>
                        <Building2 size={16} strokeWidth={1.75} />
                      </span>
                      <span className="ru-selection__rule" aria-hidden />
                      <div className="ru-selection__meta">
                        <strong>{selection.orgName}</strong>
                        <span className="ru-selection__pill">
                          {selection.rows.length} station
                          {selection.rows.length === 1 ? "" : "s"}:{" "}
                          {selection.rows.map((r) => r.stationName).join(", ")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="ru-selection ru-selection--error" role="alert">
                      {selection.message}
                    </div>
                  )
                ) : null}

                <div className="ru-form__foot">
                  <button
                    type="submit"
                    className="ru-btn ru-btn--gold"
                    disabled={busy || !canActRetailUsers || !selection?.ok}
                  >
                    <Send size={15} strokeWidth={1.75} />
                    Send dealer invite
                  </button>
                </div>

                <div className="ru-info">
                  <Info size={15} strokeWidth={1.75} />
                  <span>
                    The dealer will receive an invitation email with instructions to create their
                    account. Station External IDs bind automatically.
                  </span>
                </div>
              </form>
            </div>
          </article>

          <article className="ru-card" id="invite-staff">
            <div className="ru-card__inner">
              <div className="ru-card__head">
                <span className="ru-card__icon ru-card__icon--blue">
                  <Users size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <h2>Invite Staff</h2>
                  <p>Send an invitation to internal team members.</p>
                </div>
              </div>

              <form onSubmit={inviteStaff} className="ru-form">
                <div className="ru-form__row ru-form__row--3">
                  <div className="ru-field">
                    <label htmlFor="s-email">Email Address</label>
                    <div className="ru-field__control">
                      <Mail size={15} strokeWidth={1.75} />
                      <input
                        id="s-email"
                        type="email"
                        required
                        placeholder="name@trinityenergyltd.com"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ru-field">
                    <label htmlFor="s-first">First Name</label>
                    <div className="ru-field__control">
                      <UserRound size={15} strokeWidth={1.75} />
                      <input
                        id="s-first"
                        required
                        placeholder="First name"
                        value={staffFirst}
                        onChange={(e) => setStaffFirst(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ru-field">
                    <label htmlFor="s-last">Last Name</label>
                    <div className="ru-field__control">
                      <UserRound size={15} strokeWidth={1.75} />
                      <input
                        id="s-last"
                        required
                        placeholder="Last name"
                        value={staffLast}
                        onChange={(e) => setStaffLast(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="ru-form__row ru-form__row--2">
                  <div className="ru-field">
                    <label htmlFor="s-dept">Department</label>
                    <div className="ru-field__control">
                      <Building2 size={15} strokeWidth={1.75} />
                      <select
                        id="s-dept"
                        value={staffDept}
                        onChange={(e) => setStaffDept(e.target.value)}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="ru-field">
                    <label htmlFor="s-role">Role</label>
                    <div className="ru-field__control">
                      <Shield size={15} strokeWidth={1.75} />
                      <select
                        id="s-role"
                        value={staffRoleKey}
                        onChange={(e) => setStaffRoleKey(e.target.value)}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                        {roles.length === 0
                          ? STAFF_ROLES.map((role) => (
                              <option key={role} value={`system:${role}`}>
                                {roleLabel(role)}
                              </option>
                            ))
                          : null}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="ru-form__foot">
                  <button
                    type="submit"
                    className="ru-btn ru-btn--gold"
                    disabled={busy || !canActRetailUsers}
                  >
                    <Send size={15} strokeWidth={1.75} />
                    Send staff invite
                  </button>
                </div>

                <div className="ru-info">
                  <Info size={15} strokeWidth={1.75} />
                  <span>
                    The user will receive an invitation email with instructions to create their
                    account.
                  </span>
                </div>
              </form>
            </div>
          </article>
        </div>

        <div className="ru-tabs" role="tablist" aria-label="User management">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "active"}
            className={`ru-tab ${tab === "active" ? "is-active" : ""}`}
            onClick={() => setTab("active")}
          >
            <Users size={15} strokeWidth={1.75} />
            Active Users ({activeAll.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={`ru-tab ${tab === "pending" ? "is-active" : ""}`}
            onClick={() => setTab("pending")}
          >
            <Clock3 size={15} strokeWidth={1.75} />
            Pending Invitations ({pendingAll.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "roles"}
            className={`ru-tab ${tab === "roles" ? "is-active" : ""}`}
            onClick={() => setTab("roles")}
          >
            <Shield size={15} strokeWidth={1.75} />
            Roles &amp; Permissions
          </button>
        </div>

        {tab === "active" ? (
          <section className="ru-panel" aria-label="Active users">
            <div className="ru-panel__head">
              <div className="ru-panel__title">
                <span className="ru-panel__icon ru-panel__icon--green">
                  <Users size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <h2>Active Users ({activeAll.length})</h2>
                  <p>Users who have accepted their invitation and have access to the platform.</p>
                </div>
              </div>
              <div className="ru-panel__tools">
                <label className="ru-search">
                  <Search size={14} strokeWidth={1.75} />
                  <input
                    value={activeQuery}
                    onChange={(e) => setActiveQuery(e.target.value)}
                    placeholder="Search users..."
                    aria-label="Search active users"
                  />
                </label>
                <label className="ru-filter">
                  <Filter size={14} strokeWidth={1.75} />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    aria-label="Filter by account type"
                  >
                    <option value="ALL">All types</option>
                    <option value="DEALER">Dealer</option>
                    <option value="INTERNAL">Internal</option>
                  </select>
                </label>
              </div>
            </div>

            {active.length === 0 ? (
              <div className="ru-empty">
                <div className="ru-empty__icon">
                  <Users size={26} strokeWidth={1.5} />
                </div>
                <strong>No active users match</strong>
                <p>Try a different search or filter, or invite someone to get started.</p>
              </div>
            ) : (
              <>
                <div className="ru-table-wrap">
                  <table className="ru-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Type</th>
                        <th>Org / Station</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSlice.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <span className="ru-user">
                              <span className="ru-avatar">{initials(u.firstName, u.lastName)}</span>
                              {u.firstName} {u.lastName}
                            </span>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span
                              className={`ru-type ${
                                u.accountType === "DEALER" ? "ru-type--dealer" : "ru-type--internal"
                              }`}
                            >
                              {u.accountType === "DEALER" ? "Dealer" : "Internal"}
                            </span>
                          </td>
                          <td>{orgLabel(u)}</td>
                          <td>{roleLabel(u.role)}</td>
                          <td>
                            <span className="ru-status ru-status--active">
                              <i className="ru-status__dot" /> Active
                            </span>
                          </td>
                          <td>{formatDay(u.lastLoginAt)}</td>
                          <td>{renderActions(u)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {activePages > 1 ? (
                  <div className="ru-pager">
                    <span>
                      Page {activePage + 1} of {activePages}
                    </span>
                    <button
                      type="button"
                      disabled={activePage === 0}
                      onClick={() => setActivePage((p) => Math.max(0, p - 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      disabled={activePage >= activePages - 1}
                      onClick={() => setActivePage((p) => Math.min(activePages - 1, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {tab === "pending" ? (
          <section className="ru-panel" aria-label="Pending invitations">
            <div className="ru-panel__head">
              <div className="ru-panel__title">
                <span className="ru-panel__icon ru-panel__icon--gold">
                  <Clock3 size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <h2>Pending Invitations ({pendingAll.length})</h2>
                  <p>Invitations that have been sent but not yet accepted.</p>
                </div>
              </div>
              <div className="ru-panel__tools">
                <label className="ru-search">
                  <Search size={14} strokeWidth={1.75} />
                  <input
                    value={pendingQuery}
                    onChange={(e) => setPendingQuery(e.target.value)}
                    placeholder="Search invitations..."
                    aria-label="Search pending invitations"
                  />
                </label>
                <label className="ru-filter">
                  <Filter size={14} strokeWidth={1.75} />
                  <select
                    value={pendingType}
                    onChange={(e) => setPendingType(e.target.value as TypeFilter)}
                    aria-label="Filter invitations by type"
                  >
                    <option value="ALL">All types</option>
                    <option value="DEALER">Dealer</option>
                    <option value="INTERNAL">Internal</option>
                  </select>
                </label>
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="ru-empty">
                <div className="ru-empty__icon">
                  <Mail size={26} strokeWidth={1.5} />
                </div>
                <strong>No pending invitations yet</strong>
                <p>Invited users will appear here until they accept their invitation.</p>
              </div>
            ) : (
              <>
                <div className="ru-table-wrap">
                  <table className="ru-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Type</th>
                        <th>Org / Station</th>
                        <th>Role</th>
                        <th>Invited On</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSlice.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <span className="ru-user">
                              <span className="ru-avatar">{initials(u.firstName, u.lastName)}</span>
                              {u.firstName} {u.lastName}
                            </span>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span
                              className={`ru-type ${
                                u.accountType === "DEALER" ? "ru-type--dealer" : "ru-type--internal"
                              }`}
                            >
                              {u.accountType === "DEALER" ? "Dealer" : "Internal"}
                            </span>
                          </td>
                          <td>{orgLabel(u)}</td>
                          <td>{roleLabel(u.role)}</td>
                          <td>{formatDay(u.createdAt)}</td>
                          <td>
                            <span className="ru-status ru-status--pending">
                              <i className="ru-status__dot" /> Pending
                            </span>
                          </td>
                          <td>{renderActions(u)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pendingPages > 1 ? (
                  <div className="ru-pager">
                    <span>
                      Page {pendingPage + 1} of {pendingPages}
                    </span>
                    <button
                      type="button"
                      disabled={pendingPage === 0}
                      onClick={() => setPendingPage((p) => Math.max(0, p - 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      disabled={pendingPage >= pendingPages - 1}
                      onClick={() => setPendingPage((p) => Math.min(pendingPages - 1, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {tab === "roles" ? (
          <section className="ru-panel" aria-label="Roles and permissions">
            <div className="ru-roles">
              <aside className="ru-roles__side">
                <div className="ru-roles__side-head">
                  <div>
                    <h3>Roles</h3>
                    <p>System roles and custom templates.</p>
                  </div>
                  {canActRetailUsers ? (
                    <button
                      type="button"
                      className="ru-btn ru-btn--gold ru-roles__create"
                      onClick={() => {
                        setCreateError("");
                        setCreateOpen(true);
                      }}
                    >
                      + Create Role
                    </button>
                  ) : null}
                </div>
                <label className="ru-search" style={{ width: "100%" }}>
                  <Search size={14} strokeWidth={1.75} />
                  <input
                    value={roleQuery}
                    onChange={(e) => setRoleQuery(e.target.value)}
                    placeholder="Search roles..."
                    aria-label="Search roles"
                  />
                </label>
                <div className="ru-roles__list" role="listbox" aria-label="Roles">
                  {filteredRoles.map((role) => {
                    const activeRole = role.id === selectedRoleId;
                    const isExec = role.systemRole === "SALES_PERSON_EXECUTIVE";
                    return (
                      <button
                        key={role.id}
                        type="button"
                        role="option"
                        aria-selected={activeRole}
                        className={`ru-role-item ${activeRole ? "is-active" : ""}`}
                        onClick={() => setSelectedRoleId(role.id)}
                      >
                        <span className={`ru-role-item__icon ${isExec ? "is-exec" : ""}`} aria-hidden>
                          {isExec ? <Crown size={14} strokeWidth={1.75} /> : <Shield size={14} strokeWidth={1.75} />}
                        </span>
                        <span className="ru-role-item__body">
                          <strong>{role.name}</strong>
                          <span>{role.moduleCount} modules</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="ru-roles__main">
                {selectedRole ? (
                  <RolePermissionsPanel
                    role={selectedRole}
                    draftPerms={draftPerms}
                    selectedModuleId={selectedAppModule}
                    canEdit={canEditRolePerms}
                    canActRetailUsers={canActRetailUsers}
                    busy={busy}
                    permsDirty={permsDirty}
                    onSelectModule={setSelectedAppModule}
                    onToggleModuleAccess={toggleModuleAccess}
                    onToggleTab={togglePerm}
                    onSave={() => void saveRolePermissions()}
                    onDiscard={() => setDraftPerms(selectedRole.permissions)}
                    onDuplicate={() => void duplicateRole()}
                    onEditRole={
                      selectedRole.isSystem
                        ? undefined
                        : () => {
                            setEditRoleName(selectedRole.name);
                            setEditRoleDesc(selectedRole.description);
                            setEditRoleOpen(true);
                          }
                    }
                    onDeleteRole={selectedRole.isSystem ? undefined : () => void deleteRole()}
                  />
                ) : (
                  <div className="ru-empty">
                    <strong>Select a role</strong>
                    <p>Choose a role on the left to view and edit its permissions.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <CreateRoleModal
        open={createOpen}
        busy={busy}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onCreate={createRole}
      />

      {editRoleOpen && selectedRole && !selectedRole.isSystem ? (
        <div className="ru-modal-root" role="presentation">
          <button
            type="button"
            className="ru-modal-backdrop"
            aria-label="Close"
            onClick={() => setEditRoleOpen(false)}
          />
          <div className="ru-modal" role="dialog" aria-modal="true" aria-label="Edit role">
            <button
              type="button"
              className="ru-modal__close"
              aria-label="Close"
              onClick={() => setEditRoleOpen(false)}
            >
              <X size={16} />
            </button>
            <div className="ru-modal__head">
              <span className="ru-modal__icon" aria-hidden>
                <Pencil size={18} />
              </span>
              <div>
                <h2>Edit Role</h2>
                <p>Update the role name and description.</p>
              </div>
            </div>
            <form onSubmit={saveRoleMeta}>
              <div className="ru-modal__field">
                <label htmlFor="edit-role-name">
                  Role Name<em>*</em>
                </label>
                <div className="ru-modal__control">
                  <input
                    id="edit-role-name"
                    required
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                  />
                </div>
              </div>
              <div className="ru-modal__field">
                <label htmlFor="edit-role-desc">Description</label>
                <div className="ru-modal__control">
                  <textarea
                    id="edit-role-desc"
                    value={editRoleDesc}
                    onChange={(e) => setEditRoleDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="ru-modal__foot">
                <button type="button" className="ru-btn ru-btn--ghost" onClick={() => setEditRoleOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="ru-btn ru-btn--gold" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing && editForm ? (
        <div className="ru-edit" role="presentation">
          <button type="button" className="ru-edit__backdrop" aria-label="Close" onClick={() => setEditing(null)} />
          <div className="ru-edit__panel" role="dialog" aria-modal="true" aria-label="Edit user">
            <h2>
              Edit {editing.firstName} {editing.lastName}
            </h2>
            <form onSubmit={saveEdit} className="ru-form">
              <div className="ru-form__row ru-form__row--2">
                <div className="ru-field">
                  <label htmlFor="e-first">First name</label>
                  <div className="ru-field__control">
                    <input
                      id="e-first"
                      required
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="ru-field">
                  <label htmlFor="e-last">Last name</label>
                  <div className="ru-field__control">
                    <input
                      id="e-last"
                      required
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              {editing.accountType === "INTERNAL" ? (
                <div className="ru-field">
                  <label htmlFor="e-dept">Department</label>
                  <div className="ru-field__control">
                    <select
                      id="e-dept"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
              <div className="ru-form__row ru-form__row--2">
                <div className="ru-field">
                  <label htmlFor="e-role">Role</label>
                  <div className="ru-field__control">
                    <select
                      id="e-role"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      {(editing.accountType === "INTERNAL"
                        ? STAFF_ROLES
                        : (["DEALER_ADMIN", "DEALER_USER"] as const)
                      ).map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="ru-field">
                  <label htmlFor="e-status">Status</label>
                  <div className="ru-field__control">
                    <select
                      id="e-status"
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          status: e.target.value as EditForm["status"],
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="PENDING">Pending</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="ru-form__foot">
                <button type="button" className="ru-btn ru-btn--ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="ru-btn ru-btn--gold" disabled={busy}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
