"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  ChevronRight,
  Clock3,
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
import { StationMultiSelect } from "@/components/retail/station-multi-select";

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

type TypeFilter = "ALL" | "DEALER" | "INTERNAL";

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function orgLabel(u: RetailUser) {
  const st = u.dealerOrganization?.stations?.[0];
  return (
    st?.tradingName ||
    st?.name ||
    u.dealerOrganization?.name ||
    (u.accountType === "INTERNAL" ? "Head Office" : "—")
  );
}

function matchesQuery(u: RetailUser, q: string) {
  if (!q) return true;
  const hay = [
    u.firstName,
    u.lastName,
    u.email,
    u.role,
    u.accountType,
    u.department,
    orgLabel(u),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

type EditForm = {
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  status: "PENDING" | "ACTIVE" | "DISABLED";
};

export function RetailUsersClient() {
  const { data: session } = useSession();
  const canManageUsers = session?.user?.role === "SUPER_ADMIN";

  const [stations, setStations] = useState<StationOpt[]>([]);
  const [users, setUsers] = useState<RetailUser[]>([]);
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
  const [staffRole, setStaffRole] = useState<"STANDARD_USER" | "SUPER_ADMIN">("STANDARD_USER");

  const [pendingQuery, setPendingQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RetailUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const [sRes, uRes] = await Promise.all([
      fetch("/api/retail/stations"),
      fetch("/api/retail/users"),
    ]);
    if (sRes.ok) {
      const data = await sRes.json();
      setStations(data.stations ?? []);
    }
    if (uRes.ok) {
      const data = await uRes.json();
      setUsers(data.users ?? []);
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
        `Delete ${u.firstName} ${u.lastName} (${u.email})?\n\nThis cannot be undone.`
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

  function renderActions(u: RetailUser) {
    if (!canManageUsers) {
      return (
        <button type="button" className="ru-actions" aria-label="More actions" disabled title="Super Admin only">
          <MoreVertical size={16} />
        </button>
      );
    }
    const open = menuUserId === u.id;
    const actorEmail = session?.user?.email ?? "";
    const canDelete = mayDeleteProtectedAdmin(actorEmail, u.email);
    const protectedTarget = isProtectedSuperAdminEmail(u.email);
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
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              disabled={!canDelete}
              title={
                !canDelete && protectedTarget
                  ? "Only admin@trinityenergyltd.com can delete this Super Admin"
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
    setOk(`Dealer invite sent to ${dealerEmail}${data.activateUrl ? ` — ${data.activateUrl}` : ""}`);
    setStationCodes([]);
    setDealerEmail("");
    setDealerFirst("");
    setDealerLast("");
    await load();
  }

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch("/api/retail/invite/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: staffEmail,
        firstName: staffFirst,
        lastName: staffLast,
        department: staffDept,
        role: staffRole,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Staff invite failed");
      return;
    }
    setOk(`Staff invite sent to ${staffEmail}${data.activateUrl ? ` — ${data.activateUrl}` : ""}`);
    setStaffEmail("");
    setStaffFirst("");
    setStaffLast("");
    await load();
  }

  // Same rules as the API, so staff see why a selection can't be invited before sending.
  const selection = stationCodes.length ? checkStationSelection(stations, stationCodes) : null;
  const pendingAll = users.filter((u) => u.status === "PENDING");
  const activeAll = users.filter((u) => u.status === "ACTIVE");

  const pending = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase();
    return pendingAll.filter((u) => matchesQuery(u, q));
  }, [pendingAll, pendingQuery]);

  const active = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    return activeAll.filter((u) => {
      if (typeFilter !== "ALL" && u.accountType !== typeFilter) return false;
      return matchesQuery(u, q);
    });
  }, [activeAll, activeQuery, typeFilter]);

  return (
    <div className="ru" style={{ background: "#0a192f" }}>
      <header className="ru-head">
        <div className="ru-head__copy">
          <h1>Users</h1>
          <p>
            Manage access to the Trinity Retail Intelligence platform. Invite dealers and internal
            staff, and monitor user status.
          </p>
        </div>
        <a className="ru-secure" href="#invite-dealer" aria-label="Secure Access" style={{ background: "#122a4a" }}>
          <span className="ru-secure__icon">
            <Shield size={18} strokeWidth={1.75} />
          </span>
          <span className="ru-secure__meta">
            <strong>Secure Access</strong>
            <span>Control who can access your intelligence platform.</span>
          </span>
          <ChevronRight className="ru-secure__chev" size={16} />
        </a>
      </header>

      {error ? <div className="ru-flash ru-flash--error">{error}</div> : null}
      {ok ? <div className="ru-flash ru-flash--ok">{ok}</div> : null}

      <div className="ru-invites">
        {/* Invite dealer */}
        <article className="ru-card ru-card--dealer" id="invite-dealer" style={{ background: "#122a4a" }}>
          <div className="ru-card__glow" aria-hidden />
          <div className="ru-card__media" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets2/img/retail/dashboard-hero-station.jpg" alt="" />
          </div>
          <div className="ru-card__inner">
            <div className="ru-card__head">
              <span className="ru-card__icon ru-card__icon--gold">
                <Store size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2>Invite dealer</h2>
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
                  <label htmlFor="d-email">Email address</label>
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
                  <label htmlFor="d-first">First name</label>
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
                  <label htmlFor="d-last">Last name</label>
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
                <div className={selection.ok ? "ru-selection" : "ru-selection ru-selection--error"} role="status">
                  {selection.ok
                    ? `${selection.orgName} · ${selection.rows.length} station${selection.rows.length === 1 ? "" : "s"}: ${selection.rows.map((r) => r.stationName).join(", ")}`
                    : selection.message}
                </div>
              ) : null}

              <div className="ru-form__foot">
                <button type="submit" className="ru-btn ru-btn--gold" disabled={busy || !selection?.ok}>
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

        {/* Invite staff */}
        <article className="ru-card ru-card--staff" id="invite-staff" style={{ background: "#122a4a" }}>
          <div className="ru-card__glow" aria-hidden />
          <div className="ru-card__inner">
            <div className="ru-card__head">
              <span className="ru-card__icon ru-card__icon--blue">
                <Users size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2>Invite staff</h2>
                <p>Send an invitation to internal team members.</p>
              </div>
              <svg
                className="ru-card__sil"
                viewBox="0 0 240 120"
                width={72}
                height={36}
                aria-hidden
                style={{
                  marginLeft: "auto",
                  flexShrink: 0,
                  width: 72,
                  height: 36,
                  opacity: 0.28,
                  color: "#9ec5ff",
                  pointerEvents: "none",
                }}
              >
                <circle cx="70" cy="38" r="16" fill="currentColor" />
                <path d="M40 96c4-24 14-36 30-36s26 12 30 36" fill="currentColor" />
                <circle cx="120" cy="30" r="18" fill="currentColor" />
                <path d="M86 100c5-28 16-42 34-42s29 14 34 42" fill="currentColor" />
                <circle cx="172" cy="40" r="15" fill="currentColor" />
                <path d="M146 98c4-22 13-34 26-34s22 12 26 34" fill="currentColor" />
              </svg>
            </div>

            <form onSubmit={inviteStaff} className="ru-form">
              <div className="ru-form__row ru-form__row--3">
                <div className="ru-field">
                  <label htmlFor="s-email">Email address</label>
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
                  <label htmlFor="s-first">First name</label>
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
                  <label htmlFor="s-last">Last name</label>
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
                    <input
                      id="s-dept"
                      required
                      value={staffDept}
                      onChange={(e) => setStaffDept(e.target.value)}
                    />
                  </div>
                </div>
                <div className="ru-field">
                  <label htmlFor="s-role">Role</label>
                  <div className="ru-field__control">
                    <Shield size={15} strokeWidth={1.75} />
                    <select
                      id="s-role"
                      value={staffRole}
                      onChange={(e) =>
                        setStaffRole(e.target.value as "STANDARD_USER" | "SUPER_ADMIN")
                      }
                    >
                      <option value="STANDARD_USER">Standard User</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="ru-form__foot">
                <button type="submit" className="ru-btn ru-btn--blue" disabled={busy}>
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

      {/* Pending */}
      <section className="ru-panel" style={{ background: "#122a4a" }}>
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
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="ru-empty">
            <div className="ru-empty__icon">
              <Mail size={26} strokeWidth={1.5} />
              <span className="ru-empty__badge">
                <Clock3 size={12} strokeWidth={2} />
              </span>
            </div>
            <strong>No pending invitations yet</strong>
            <p>Invited users will appear here until they accept their invitation.</p>
          </div>
        ) : (
          <div className="ru-table-wrap">
            <table className="ru-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Org / Station</th>
                  <th>Role</th>
                  <th>Invited on</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
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
        )}
      </section>

      {/* Active */}
      <section className="ru-panel" style={{ background: "#122a4a" }}>
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
                  <th>Last active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((u) => (
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
                    <td>
                      {u.accountType === "INTERNAL"
                        ? u.department || roleLabel(u.role)
                        : roleLabel(u.role)}
                    </td>
                    <td>
                      <span className="ru-status">
                        <i className="ru-status__dot" /> Active
                      </span>
                    </td>
                    <td>{formatDay(u.lastLoginAt ?? u.createdAt)}</td>
                    <td>{renderActions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && editForm ? (
        <div className="ru-modal" role="dialog" aria-modal aria-labelledby="ru-edit-title">
          <div className="ru-modal__panel" style={{ background: "#122a4a" }}>
            <header className="ru-modal__head">
              <div>
                <h2 id="ru-edit-title">Edit user</h2>
                <p>{editing.email}</p>
              </div>
              <button
                type="button"
                className="ru-modal__close"
                aria-label="Close"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                }}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={saveEdit} className="ru-modal__form">
              <div className="ru-form__row ru-form__row--2">
                <div className="ru-field">
                  <label htmlFor="edit-first">First name</label>
                  <div className="ru-field__control">
                    <UserRound size={15} strokeWidth={1.75} />
                    <input
                      id="edit-first"
                      required
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="ru-field">
                  <label htmlFor="edit-last">Last name</label>
                  <div className="ru-field__control">
                    <UserRound size={15} strokeWidth={1.75} />
                    <input
                      id="edit-last"
                      required
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {editing.accountType === "INTERNAL" ? (
                <div className="ru-field">
                  <label htmlFor="edit-dept">Department</label>
                  <div className="ru-field__control">
                    <Building2 size={15} strokeWidth={1.75} />
                    <input
                      id="edit-dept"
                      required
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}

              <div className="ru-form__row ru-form__row--2">
                <div className="ru-field">
                  <label htmlFor="edit-role">Role</label>
                  <div className="ru-field__control">
                    <Shield size={15} strokeWidth={1.75} />
                    <select
                      id="edit-role"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      {editing.accountType === "INTERNAL" ? (
                        <>
                          <option value="STANDARD_USER">Standard User</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                        </>
                      ) : (
                        <>
                          <option value="DEALER_ADMIN">Dealer Admin</option>
                          <option value="DEALER_USER">Dealer User</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="ru-field">
                  <label htmlFor="edit-status">Status</label>
                  <div className="ru-field__control">
                    <Clock3 size={15} strokeWidth={1.75} />
                    <select
                      id="edit-status"
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

              <div className="ru-modal__actions">
                <button
                  type="button"
                  className="ru-btn ru-btn--ghost"
                  onClick={() => {
                    setEditing(null);
                    setEditForm(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="ru-btn" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
