import { redirect } from "next/navigation";
import { canAccessRetail } from "@/lib/access";
import { requireInternal } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { RetailShell } from "@/components/retail/retail-shell";

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInternal();
  if (!canAccessRetail(session.user.role)) redirect("/intelligence/dashboard");
  return (
    <AppShell fullBleed suppressIntelligenceBackground>
      <RetailShell role={session.user.role}>{children}</RetailShell>
    </AppShell>
  );
}
