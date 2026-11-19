import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { loadAnalytics } from "@/lib/insights/load";
import { StaffAnalytics } from "@/components/staff/staff-analytics";
import "@/app/intelligence/retail/staff-orders.css";
import "@/app/intelligence/retail/staff-analytics.css";

export const dynamic = "force-dynamic";

export default async function StaffAnalyticsPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view")) redirect("/intelligence/dashboard");
  return <StaffAnalytics data={await loadAnalytics()} />;
}
