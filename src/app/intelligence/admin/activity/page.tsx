import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";

/** Legacy Admin Activity Logs → Platform Settings Activity tab. */
export default async function ActivityLogsPage() {
  await requirePermission("activity", "view");
  redirect("/intelligence/retail/settings?tab=activity");
}
