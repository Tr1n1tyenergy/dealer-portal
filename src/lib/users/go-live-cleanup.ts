import type { PrismaClient } from "@prisma/client";

export type CleanupPlan = {
  users: { email: string; name: string; company: string | null }[];
  companies: string[];
  orders: { reference: string; status: string; createdBy: string; odooQuotationNumber: string | null }[];
  conversations: number;
  messages: number;
  /** Dealers in these companies who are NOT being removed; their company's orders still go. */
  otherUsersInCompanies: string[];
};
type Result = { ok: true; plan: CleanupPlan; deleted: boolean } | { ok: false; message: string };

/**
 * One-off go-live clean-up (Adrian, 4 Nov): remove tester dealer accounts, every order of their companies
 * (lines, PFIs, payments, history and documents cascade), and their message threads (both sides).
 * Companies and stations stay so real clients can be invited onto them. Dry run unless `confirm`.
 * Only DEALER accounts can be removed; any unknown email refuses the whole run.
 */
export async function goLiveCleanup(db: PrismaClient, rawEmails: string[], opts: { confirm: boolean; label: string }): Promise<Result> {
  const emails = [...new Set(rawEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) return { ok: false, message: "Give at least one tester email." };
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, firstName: true, lastName: true, accountType: true, dealerOrganizationId: true, dealerOrganization: { select: { name: true } } },
  });
  const missing = emails.filter((e) => !users.some((u) => u.email.toLowerCase() === e));
  if (missing.length) return { ok: false, message: `No user with email: ${missing.join(", ")}. Nothing was changed.` };
  const notDealers = users.filter((u) => u.accountType !== "DEALER");
  if (notDealers.length) return { ok: false, message: `Only dealer accounts can be cleaned up; refusing: ${notDealers.map((u) => u.email).join(", ")}. Nothing was changed.` };

  const userIds = users.map((u) => u.id);
  const orgIds = [...new Set(users.flatMap((u) => (u.dealerOrganizationId ? [u.dealerOrganizationId] : [])))];
  const orderWhere = { OR: [{ dealerOrganizationId: { in: orgIds } }, { createdById: { in: userIds } }] };
  const convoWhere = { participants: { some: { userId: { in: userIds } } } };
  const [orders, conversations, messages, others] = await Promise.all([
    db.dealerOrder.findMany({ where: orderWhere, orderBy: { createdAt: "asc" }, select: { reference: true, status: true, odooQuotationNumber: true, createdBy: { select: { email: true } } } }),
    db.conversation.count({ where: convoWhere }),
    db.message.count({ where: { conversation: convoWhere } }),
    db.user.findMany({ where: { dealerOrganizationId: { in: orgIds }, id: { notIn: userIds } }, select: { email: true } }),
  ]);
  const plan: CleanupPlan = {
    users: users.map((u) => ({ email: u.email, name: `${u.firstName} ${u.lastName}`.trim(), company: u.dealerOrganization?.name ?? null })),
    companies: [...new Set(users.flatMap((u) => (u.dealerOrganization ? [u.dealerOrganization.name] : [])))],
    orders: orders.map((o) => ({ reference: o.reference, status: o.status, createdBy: o.createdBy.email, odooQuotationNumber: o.odooQuotationNumber })),
    conversations,
    messages,
    otherUsersInCompanies: others.map((u) => u.email),
  };
  if (!opts.confirm) return { ok: true, plan, deleted: false };

  // All or nothing: orders first (they are what blocks deleting a user), then threads, then the accounts.
  await db.$transaction([
    db.dealerOrder.deleteMany({ where: orderWhere }),
    db.conversation.deleteMany({ where: convoWhere }),
    db.user.deleteMany({ where: { id: { in: userIds } } }),
    db.activityLog.create({
      data: {
        action: "GO_LIVE_CLEANUP",
        entity: "User",
        entityId: opts.label,
        metaJson: JSON.stringify({ users: plan.users.map((u) => u.email), orders: plan.orders.map((o) => o.reference), conversations, messages }),
      },
    }),
  ]);
  return { ok: true, plan, deleted: true };
}
