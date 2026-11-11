import { redirect } from "next/navigation";
import { RetailUsersClient } from "@/components/retail/retail-users-client";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";

export default async function RetailUsersPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "retailUsers", "view")) redirect("/intelligence/retail");
  return <RetailUsersClient />;
}
