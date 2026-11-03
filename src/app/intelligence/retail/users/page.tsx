import { redirect } from "next/navigation";
import { RetailUsersClient } from "@/components/retail/retail-users-client";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { retailUsersControls } from "@/lib/users/user-controls";

export default async function RetailUsersPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "retailUsers", "view")) redirect("/intelligence/retail");
  // Decided on the server, so the first paint already shows the right controls.
  return <RetailUsersClient controls={retailUsersControls(session.user)} />;
}
