import { requireSession } from "@/lib/session";
import {
  AppShell,
  ModulesFooterStrip,
  ModulesHero,
} from "@/components/layout/app-shell";
import { ModuleCards } from "@/components/dashboard/module-cards";

export default async function DashboardPage() {
  await requireSession();

  return (
    <AppShell activeNav="modules">
      <ModulesHero />
      <ModuleCards />
      <ModulesFooterStrip />
    </AppShell>
  );
}
