import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseJsonObject } from "@/lib/utils";

export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireSession();
  const { id } = await params;
  const isAdmin = auth.user.role === "SUPER_ADMIN";

  const report = await prisma.report.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.user.id }),
    },
  });

  if (!report) notFound();

  const content = parseJsonObject<{
    modules?: string[];
    status?: string;
    summary?: string;
  }>(report.contentJson);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
            Report Viewer
          </div>
          <h1 className="mt-2 text-3xl font-black text-trinity-navy">{report.title}</h1>
        </div>
        <Link href="/intelligence/reports">
          <Button variant="outline">Back to Archive</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>Category: {report.category.replaceAll("_", " ")}</div>
            <div>Status: {content?.status ?? "framework"}</div>
            <div>{report.description}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Future Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              {(content?.modules ?? ["Fuel Retail Reports", "Non Fuel Retail Reports"]).map(
                (m) => (
                  <li key={m} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-trinity-gold" />
                    {m}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {content?.summary ?? "Report framework ready for future connectors."}
        </CardContent>
      </Card>
    </AppShell>
  );
}
