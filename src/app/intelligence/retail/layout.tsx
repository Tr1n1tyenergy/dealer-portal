import { redirect } from "next/navigation";
import { canAccessRetail } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import "@/app/intelligence/retail/retail-portal.css";

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInternal();
  if (!canAccessRetail(session.user)) redirect("/intelligence/dashboard");
  return (
    <AppShell fullBleed suppressIntelligenceBackground>
      <div className="ri-shell">
        <div className="ri-content">{children}</div>
      </div>
    </AppShell>
  );
}
