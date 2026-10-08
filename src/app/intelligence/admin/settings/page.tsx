import { requireSuperAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Super Admin
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">System Settings</h1>
        <p className="mt-2 text-slate-500">
          Platform configuration store for future connectors (email, storage, AI).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>Auth: NextAuth credentials</div>
            <div>Email: Resend ({process.env.RESEND_API_KEY ? "configured" : "dev console fallback"})</div>
            <div>Storage: AWS S3 hooks prepared</div>
            <div>AI: Whisper / OpenAI pipeline placeholders ready</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stored Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            {settings.length === 0 ? (
              <p>No custom settings yet. Seed defaults via admin tools as needed.</p>
            ) : (
              settings.map((s) => (
                <div key={s.id} className="flex justify-between gap-4 border-b border-black/5 py-2">
                  <span className="font-semibold text-trinity-navy">{s.key}</span>
                  <span>{s.value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
