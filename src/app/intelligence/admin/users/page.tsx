import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { UsersAdminClient } from "@/components/admin/users-admin-client";
import { PageHead } from "@/components/layout/page-head";

export default async function AdminUsersPage() {
  const session = await requirePermission("adminUsers", "view");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AppShell>
      <PageHead title="Admin users" description="Create and manage Trinity staff accounts. There is no public sign-up." />
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
        actor={{ ...session.user, email: session.user.email ?? "" }}
      />
    </AppShell>
  );
}
