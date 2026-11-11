import { requireInternal } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { RetailShell } from "@/components/retail/retail-shell";

/** Legacy dark Retail Interface chrome for Orders / Users / Messaging / Analytics. */
export default async function RetailWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireInternal();
  return (
    <AppShell fullBleed suppressIntelligenceBackground>
      <RetailShell user={session.user}>{children}</RetailShell>
    </AppShell>
  );
}
