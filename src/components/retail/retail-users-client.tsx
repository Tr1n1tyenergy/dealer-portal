"use client";

import { useCallback, useEffect, useState } from "react";

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
  createdAt: string;
  dealerOrganization?: {
    name: string;
    code: string;
    stations: { name: string; tradingName: string | null; code: string | null }[];
  } | null;
};

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
  const pending = users.filter((u) => u.status === "PENDING");
  const active = users.filter((u) => u.status === "ACTIVE");

  return (
    <>
      <h1 className="ri-page-title">Users</h1>
      <p className="ri-page-sub">
        Invite dealers by station (External IDs auto-bound). Invite staff to the intelligence portal.
      </p>

      {error ? <div className="ri-alert ri-alert--error">{error}</div> : null}
      {ok ? <div className="ri-alert ri-alert--ok">{ok}</div> : null}

      <div className="ri-panel">
        <div className="ri-panel__title">Invite dealer</div>
        <p style={{ marginTop: "0.35rem", fontSize: "0.85rem", color: "var(--ri-muted)" }}>
          Choose the station (e.g. Kitanga). Partner and station External IDs bind automatically.
          Company trading name is used after activation — not as the invite label.
        </p>
        <form onSubmit={inviteDealer} className="ri-form-grid">
          <div className="ri-field">
            <label htmlFor="station">Station</label>
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
          <div className="ri-field">
            <label htmlFor="d-email">Email</label>
            <input
              id="d-email"
              type="email"
              required
              value={dealerEmail}
              onChange={(e) => setDealerEmail(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="d-first">First name</label>
            <input
              id="d-first"
              required
              value={dealerFirst}
              onChange={(e) => setDealerFirst(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="d-last">Last name</label>
            <input
              id="d-last"
              required
              value={dealerLast}
              onChange={(e) => setDealerLast(e.target.value)}
            />
          </div>
          <div className="ri-field" style={{ alignSelf: "end" }}>
            <button type="submit" className="ri-btn" disabled={busy}>
              Send dealer invite
            </button>
          </div>
        </form>
      </div>

      <div className="ri-panel">
        <div className="ri-panel__title">Invite staff</div>
        <form onSubmit={inviteStaff} className="ri-form-grid">
          <div className="ri-field">
            <label htmlFor="s-email">Email</label>
            <input
              id="s-email"
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="s-first">First name</label>
            <input
              id="s-first"
              required
              value={staffFirst}
              onChange={(e) => setStaffFirst(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="s-last">Last name</label>
            <input
              id="s-last"
              required
              value={staffLast}
              onChange={(e) => setStaffLast(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="s-dept">Department</label>
            <input
              id="s-dept"
              required
              value={staffDept}
              onChange={(e) => setStaffDept(e.target.value)}
            />
          </div>
          <div className="ri-field">
            <label htmlFor="s-role">Role</label>
            <select
              id="s-role"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as "STANDARD_USER" | "SUPER_ADMIN")}
            >
              <option value="STANDARD_USER">Standard User</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div className="ri-field" style={{ alignSelf: "end" }}>
            <button type="submit" className="ri-btn" disabled={busy}>
              Send staff invite
            </button>
          </div>
        </form>
      </div>

      <div className="ri-panel">
        <div className="ri-panel__title">Pending ({pending.length})</div>
        <UserTable users={pending} />
      </div>

      <div className="ri-panel">
        <div className="ri-panel__title">Active ({active.length})</div>
        <UserTable users={active} />
      </div>
    </>
  );
}

function UserTable({ users }: { users: RetailUser[] }) {
  if (users.length === 0) {
    return (
      <p style={{ marginTop: "0.75rem", color: "var(--ri-muted)", fontSize: "0.85rem" }}>
        None yet.
      </p>
    );
  }
  return (
    <table className="ri-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Type</th>
          <th>Org / station</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const st = u.dealerOrganization?.stations?.[0];
          const orgLabel =
            st?.tradingName ||
            st?.name ||
            u.dealerOrganization?.name ||
            (u.accountType === "INTERNAL" ? "—" : "");
          return (
            <tr key={u.id}>
              <td>
                {u.firstName} {u.lastName}
              </td>
              <td>{u.email}</td>
              <td>
                {u.accountType} / {u.role}
              </td>
              <td>{orgLabel}</td>
              <td>
                <span className="ri-badge">{u.status}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
