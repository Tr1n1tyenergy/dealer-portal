import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { UsersAdminClient } from "@/components/admin/users-admin-client";
import { PageHead } from "@/components/layout/page-head";
import { AccessRequestsPanel } from "@/components/admin/access-requests-panel";
import { canUser } from "@/lib/permissions";
import { pendingAccessRequests } from "@/lib/users/access-requests";

export default async function AdminUsersPage() {
  const session = await requirePermission("adminUsers", "view");
  const [users, requests] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    canUser(session.user, "adminUsers", "act") ? pendingAccessRequests() : Promise.resolve([]),
  ]);

  return (
    <AppShell>
      <PageHead title="Admin users" description="Create and manage Trinity staff accounts. There is no public sign-up." />
      <AccessRequestsPanel requests={requests} />
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
