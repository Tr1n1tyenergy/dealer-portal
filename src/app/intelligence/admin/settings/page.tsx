import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";

/** Legacy Executive Platform settings URL — preserve bookmark; System tab holds Environment + Stored Settings. */
export default async function AdminSettingsRedirectPage() {
  await requirePermission("settings", "view");
  redirect("/intelligence/retail/settings?tab=system");
}
