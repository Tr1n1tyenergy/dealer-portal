import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { ReportsClient } from "@/components/reports/reports-client";
import Link from "next/link";

export default async function ReportsPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === "SUPER_ADMIN";

  const reports = await prisma.report.findMany({
    where: isAdmin ? undefined : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Module Framework
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Retail Interface</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Expandable framework for Fuel Retail and Non-Fuel Retail intelligence. Dealer order operations
          now live in this module, separate from the external Dealer Portal.
        </p>
        <Link href="/intelligence/reports/dealer-operations" className="mt-4 inline-flex rounded-xl bg-trinity-navy px-4 py-2 text-sm font-bold text-white">
          Open Dealer Operations
        </Link>
      </div>
      <ReportsClient
        initialReports={reports.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          description: r.description,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
