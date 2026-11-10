"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roleLabel, STAFF_ROLES } from "@/lib/access";
import { canUser, type StaffUser } from "@/lib/permissions";
import { adminRowActions } from "@/lib/users/user-controls";
import { PermissionsDialog } from "./permissions-dialog";
import "./users-admin.css";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: string;
  status: string;
  accountType: string;
  permissions: string;
};

/** Admin → Users: create staff accounts and manage each one; only the buttons the signed-in person may use. */
export function UsersAdminClient({
  initialUsers,
  actor,
}: {
  initialUsers: UserRow[];
  actor: StaffUser & { email: string; id: string };
}) {
  const canManage = canUser(actor, "adminUsers", "act");
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "Retail Operations",
    role: "STANDARD_USER",
  });
  const [inviteNotice, setInviteNotice] = useState("");
  const [permissionsFor, setPermissionsFor] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInviteNotice("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Unable to create user");
      return;
    }

    setInviteNotice(
      data.invitationSent
        ? "User created. An activation email was sent."
        : "User created."
    );
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      department: "Retail Operations",
      role: "STANDARD_USER",
    });
    await refresh();
    router.refresh();
  }

  async function patchUser(id: string, payload: Record<string, unknown>) {
    setError("");
    setInviteNotice("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Unable to update user");
      return;
    }
    if (payload.resetInvite && data.invitationSent) {
      setInviteNotice("Invitation email re-sent.");
    }
    await refresh();
    router.refresh();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    setError("");
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Unable to delete user");
      return;
    }
    await refresh();
    router.refresh();
  }

  return (
    <div className="ua">
      {canManage ? (
        <section className="ui-panel ua-create" aria-labelledby="ua-create-title">
          <h2 id="ua-create-title" className="ui-section-title">
            Create a user
          </h2>
          <form onSubmit={createUser} className="ua-form">
            <label className="ui-field">
              First name
              <input className="ui-input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </label>
            <label className="ui-field">
              Last name
              <input className="ui-input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </label>
            <label className="ui-field">
              Email
              <input className="ui-input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="ui-field">
              Department
              <input className="ui-input" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="ui-field">
              Role
              <select className="ui-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="ua-flash ua-flash--error" role="alert">
                {error}
              </p>
            ) : null}
            {inviteNotice ? (
              <p className="ua-flash ua-flash--ok" role="status">
                {inviteNotice}
              </p>
            ) : null}
            <div className="ua-form__foot">
              <button type="submit" className="ui-btn ui-btn--primary" disabled={loading}>
                {loading ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        </section>
      ) : error ? (
        <p className="ua-flash ua-flash--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="ui-panel" aria-labelledby="ua-list-title">
        <h2 id="ua-list-title" className="ui-section-title">
          Users ({users.length})
        </h2>
        <table className="ua-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              {canManage ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const can = adminRowActions(actor, u);
              return (
                <tr key={u.id}>
                  <td className="ua-name">
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.department}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>
                    <span className={`ui-chip ui-chip--${u.status === "ACTIVE" ? "done" : u.status === "PENDING" ? "dealer" : "muted"}`}>
                      {u.status === "ACTIVE" ? "Active" : u.status === "PENDING" ? "Pending" : "Disabled"}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <div className="ua-actions">
                        {can.toggle ? (
                          <button
                            type="button"
                            className="ui-btn ui-btn--secondary"
                            onClick={() => void patchUser(u.id, { status: u.status === "DISABLED" ? "ACTIVE" : "DISABLED" })}
                          >
                            {u.status === "DISABLED" ? "Enable" : "Disable"}
                          </button>
                        ) : null}
                        {can.resetInvite ? (
                          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => void patchUser(u.id, { resetInvite: true })}>
                            Reset invite
                          </button>
                        ) : null}
                        {can.permissions ? (
                          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setPermissionsFor(u)}>
                            Permissions
                          </button>
                        ) : null}
                        {can.delete ? (
                          <button type="button" className="ui-btn ui-btn--destructive" onClick={() => void deleteUser(u.id)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {permissionsFor ? (
        <PermissionsDialog
          person={permissionsFor}
          onClose={() => setPermissionsFor(null)}
          onSaved={() => {
            setPermissionsFor(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
