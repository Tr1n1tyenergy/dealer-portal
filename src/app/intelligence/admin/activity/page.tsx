import { format } from "date-fns";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PageHead } from "@/components/layout/page-head";
import "../admin.css";

export default async function ActivityLogsPage() {
  await requirePermission("activity", "view");

  const logs = await prisma.activityLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell>
      <PageHead title="Activity log" description="The latest 100 actions across the portal." />
      <section className="ui-panel">
        {logs.length === 0 ? (
          <p className="adm-empty">No activity yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="adm-soft">{format(log.createdAt, "dd MMM yyyy HH:mm")}</td>
                  <td className="adm-strong">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entity ?? "—"}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
