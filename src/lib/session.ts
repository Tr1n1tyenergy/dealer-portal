import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canUser, type PermissionLevel, type PermissionModule } from "@/lib/permissions";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/access");
  }
  return session;
}

export async function requireInternal() {
  const session = await requireSession();
  if (session.user.accountType && session.user.accountType !== "INTERNAL") {
    redirect(session.user.accountType === "DEALER" ? "/dealer/dashboard" : "/depot/dashboard");
  }
  return session;
}

export async function requireDealer() {
  const session = await getSession();
  if (!session?.user) redirect("/access");
  if (session.user.accountType !== "DEALER" || !session.user.dealerOrganizationId) {
    redirect("/access");
  }
  return session;
}

export async function requireDepot() {
  const session = await getSession();
  if (!session?.user) redirect("/access");
  if (session.user.accountType !== "DEPOT" && session.user.role !== "SUPER_ADMIN") {
    redirect("/access");
  }
  return session;
}

/** Staff page that needs a module permission; anyone else goes back to the dashboard. */
export async function requirePermission(module: PermissionModule, level: PermissionLevel) {
  const session = await requireInternal();
  if (!canUser(session.user, module, level)) redirect("/intelligence/dashboard");
  return session;
}
