/**
 * Safety rules shared by both user-admin screens (Admin → Users and Retail Interface → Users),
 * so the two routes can't drift apart. Each returns a refusal to send back, or null to proceed.
 */
import { prisma } from "@/lib/prisma";

export type Refusal = { status: 400 | 409; message: string };

type Target = { id: string; role: string; status: string; accountType: string };

/** The last active Super Admin can't be demoted, disabled or deleted (or nobody can administer users). */
export async function lastSuperAdminRefusal(
  target: Target,
  change: { role?: string; status?: string; deleting?: boolean }
): Promise<Refusal | null> {
  if (target.role !== "SUPER_ADMIN" || target.status !== "ACTIVE") return null;
  const losesAdmin =
    change.deleting || (change.role && change.role !== "SUPER_ADMIN") || (change.status && change.status !== "ACTIVE");
  if (!losesAdmin) return null;

  const others = await prisma.user.count({
    where: { id: { not: target.id }, role: "SUPER_ADMIN", status: "ACTIVE", accountType: "INTERNAL" },
  });
  if (others > 0) return null;
  return {
    status: 400,
    message: change.deleting
      ? "Cannot delete the last active Admin."
      : "Cannot demote or disable the last active Admin.",
  };
}

/**
 * Users with orders, messages, reports, presentations or note sessions are never deleted:
 * orders require their creator, and the rest would be erased along with the user.
 */
export async function historyRefusal(userId: string): Promise<Refusal | null> {
  const counts = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: { ordersCreated: true, messagesSent: true, reports: true, presentations: true, noteSessions: true },
      },
    },
  });
  const history = counts ? Object.values(counts._count).some((n) => n > 0) : false;
  return history
    ? { status: 409, message: "This user has order or message history — disable the account instead." }
    : null;
}

/** One live (pending or active) dealer login per company, also when a disabled login is switched back on. */
export async function dealerLoginRefusal(
  target: { id: string; accountType: string; dealerOrganizationId: string | null },
  nextStatus: string | undefined
): Promise<Refusal | null> {
  if (target.accountType !== "DEALER" || !target.dealerOrganizationId) return null;
  if (nextStatus !== "ACTIVE" && nextStatus !== "PENDING") return null;

  const other = await prisma.user.findFirst({
    where: {
      id: { not: target.id },
      accountType: "DEALER",
      status: { in: ["PENDING", "ACTIVE"] },
      dealerOrganizationId: target.dealerOrganizationId,
    },
    select: { email: true, dealerOrganization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!other) return null;
  return {
    status: 409,
    message: `${other.dealerOrganization?.name ?? "This company"} already has a dealer login (${other.email}). Disable it before enabling another.`,
  };
}
