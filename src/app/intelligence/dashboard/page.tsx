import { requireSession } from "@/lib/session";
import { splitModules } from "@/lib/modules";
import { loadHomeCounts, summaryLine } from "@/lib/dashboard/summary";
import { greetingForHour } from "@/lib/retail/staff-home";
import { nairobiParts } from "@/lib/time/nairobi";
import { roleLabel } from "@/lib/access";
import { ModulesHome } from "@/components/dashboard/modules-home";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const { work, admin } = splitModules(user);
  const counts = await loadHomeCounts(user);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";

  return (
    <ModulesHome
      greeting={greetingForHour(nairobiParts(new Date()).hour)}
      line={summaryLine(counts)}
      name={name}
      role={user.role ? roleLabel(user.role) : (user.department ?? "Staff")}
      work={work}
      admin={admin}
      needYou={counts.paymentsToConfirm ?? 0}
    />
  );
}
