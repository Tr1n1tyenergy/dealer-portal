import { redirect } from "next/navigation";
import { canAccessRetail } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { RetailShell } from "@/components/retail/retail-shell";

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInternal();
  if (!canAccessRetail(session.user)) redirect("/intelligence/dashboard");
  return (
    <AppShell fullBleed suppressIntelligenceBackground>
      <RetailShell user={session.user}>{children}</RetailShell>
    </AppShell>
  );
}
