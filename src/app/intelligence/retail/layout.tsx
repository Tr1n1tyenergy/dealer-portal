import { requireInternal } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { RetailShell } from "@/components/retail/retail-shell";

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  await requireInternal();
  return (
    <AppShell fullBleed>
      <RetailShell>{children}</RetailShell>
    </AppShell>
  );
}
