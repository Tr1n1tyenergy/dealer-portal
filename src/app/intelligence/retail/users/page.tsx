import { redirect } from "next/navigation";
import { RetailUsersClient } from "@/components/retail/retail-users-client";
import { can } from "@/lib/access";
import { requireInternal } from "@/lib/session";

export default async function RetailUsersPage() {
  const session = await requireInternal();
  if (!can(session.user.role, "retail.users")) redirect("/intelligence/retail");
  return <RetailUsersClient />;
}
