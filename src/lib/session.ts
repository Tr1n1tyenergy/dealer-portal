import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

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

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/intelligence/dashboard");
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
