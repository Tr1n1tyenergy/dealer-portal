import { format } from "date-fns";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function ActivityLogsPage() {
  await requirePermission("activity", "view");

  const logs = await prisma.activityLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Admin
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Activity Logs</h1>
        <p className="mt-2 text-slate-500">Recent system activity across TRI modules.</p>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">When</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-black/5">
                  <td className="px-6 py-4 text-slate-500">
                    {format(log.createdAt, "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="px-6 py-4 font-semibold text-trinity-navy">
                    {log.actor
                      ? `${log.actor.firstName} ${log.actor.lastName}`
                      : "System"}
                  </td>
                  <td className="px-6 py-4">{log.action}</td>
                  <td className="px-6 py-4">
                    {log.entity ?? "—"}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={4}>
                    No activity yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
