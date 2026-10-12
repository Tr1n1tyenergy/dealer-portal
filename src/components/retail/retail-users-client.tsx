"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  Clock3,
  Filter,
  Info,
  Mail,
  MapPin,
  MoreVertical,
  Search,
  Send,
  Shield,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import "@/app/intelligence/retail/retail-users.css";

type StationOpt = {
  stationCode: string;
  stationName: string;
  tradingName: string;
  invitable: boolean;
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

export function RetailUsersClient() {
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [users, setUsers] = useState<RetailUser[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [stationCode, setStationCode] = useState("");
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

  async function inviteDealer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch("/api/retail/invite/dealer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationCode,
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

  const invitable = stations.filter((s) => s.invitable);
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
                <p>Send an invitation to a dealer from a specific station.</p>
              </div>
            </div>

            <form onSubmit={inviteDealer} className="ru-form">
              <div className="ru-form__row ru-form__row--4">
                <div className="ru-field">
                  <label htmlFor="station">Station</label>
                  <div className="ru-field__control">
                    <MapPin size={15} strokeWidth={1.75} />
                    <select
                      id="station"
                      required
                      value={stationCode}
                      onChange={(e) => setStationCode(e.target.value)}
                    >
                      <option value="">Select station…</option>
                      {invitable.map((s) => (
                        <option key={s.stationCode} value={s.stationCode}>
                          {s.stationName}
                        </option>
                      ))}
                    </select>
                  </div>
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

              <div className="ru-form__foot">
                <button type="submit" className="ru-btn ru-btn--gold" disabled={busy}>
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
                    <td>
                      <button type="button" className="ru-actions" aria-label="More actions" disabled>
                        <MoreVertical size={16} />
                      </button>
                    </td>
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
                    <td>
                      <button type="button" className="ru-actions" aria-label="More actions" disabled>
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
