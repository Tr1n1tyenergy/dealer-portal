import { requirePermission } from "@/lib/session";
import { canUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { UsersAdminClient } from "@/components/admin/users-admin-client";

export default async function AdminUsersPage() {
  const session = await requirePermission("adminUsers", "view");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Admin
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Users</h1>
        <p className="mt-2 text-slate-500">
          Create and manage TRI accounts. There is no public registration.
        </p>
      </div>
      <UsersAdminClient
        initialUsers={users.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          department: u.department,
          role: u.role,
          status: u.status,
          accountType: u.accountType,
          permissions: u.permissions,
        }))}
        canManage={canUser(session.user, "adminUsers", "act")}
      />
    </AppShell>
  );
}
