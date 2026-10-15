"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roleLabel, STAFF_ROLES } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: string;
  status: string;
};

export function UsersAdminClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "Retail Operations",
    role: "STANDARD_USER",
    permissions: "reports,note-taker,presentations",
  });
  const [inviteNotice, setInviteNotice] = useState("");
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
      body: JSON.stringify({
        ...form,
        permissions: form.permissions
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      }),
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
      permissions: "reports,note-taker,presentations",
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
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await refresh();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>First Name</Label>
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Permissions</Label>
              <Input
                value={form.permissions}
                onChange={(e) => setForm({ ...form, permissions: e.target.value })}
                placeholder="reports,note-taker,presentations"
              />
            </div>
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
                {error}
              </div>
            ) : null}
            {inviteNotice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:col-span-2">
                {inviteNotice}
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="card-premium overflow-hidden">
        <div className="border-b border-black/5 px-6 py-4 text-lg font-bold text-trinity-navy">
          Users
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-black/5">
                  <td className="px-6 py-4 font-semibold text-trinity-navy">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">{u.department}</td>
                  <td className="px-6 py-4">{roleLabel(u.role)}</td>
                  <td className="px-6 py-4">{u.status}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void patchUser(u.id, {
                            status: u.status === "DISABLED" ? "ACTIVE" : "DISABLED",
                          })
                        }
                      >
                        {u.status === "DISABLED" ? "Enable" : "Disable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patchUser(u.id, { resetInvite: true })}
                      >
                        Reset Invite
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void deleteUser(u.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
