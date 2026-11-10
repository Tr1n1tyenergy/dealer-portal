import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PageHead } from "@/components/layout/page-head";
import "../admin.css";

export default async function AdminSettingsPage() {
  await requirePermission("settings", "view");

  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });

  return (
    <AppShell>
      <PageHead title="Settings" description="How the portal is set up, and any stored settings." />
      <div className="adm-grid">
        <section className="ui-panel" aria-labelledby="adm-env">
          <h2 id="adm-env" className="ui-section-title">
            Set-up
          </h2>
          <dl className="adm-list">
            <div>
              <dt>Sign-in</dt>
              <dd>Email and password (NextAuth)</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{process.env.RESEND_API_KEY ? "Resend, configured" : "Resend, not configured: invites and resets can't be sent"}</dd>
            </div>
          </dl>
        </section>
        <section className="ui-panel" aria-labelledby="adm-stored">
          <h2 id="adm-stored" className="ui-section-title">
            Stored settings
          </h2>
          {settings.length === 0 ? (
            <p className="adm-empty">No stored settings yet.</p>
          ) : (
            <dl className="adm-list">
              {settings.map((s) => (
                <div key={s.id}>
                  <dt>{s.key}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </AppShell>
  );
}
