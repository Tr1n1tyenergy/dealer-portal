import { canUser, type StaffUser } from "@/lib/permissions";
import { nairobiTodayStart } from "@/lib/retail/staff-home";

/** Live Retail counts for the modules page. `null` = not allowed, or the query failed: leave it out. */
export type HomeCounts = {
  ordersToday: number | null;
  paymentsToConfirm: number | null;
  unreadMessages: number | null;
  /** True when an allowed count failed to load, so "nothing waiting" can't be claimed. */
  incomplete?: boolean;
};

type CountDb = {
  dealerOrder: { count: (args: { where: { createdAt: { gte: Date } } }) => Promise<number> };
  paymentRecord: { count: (args: { where: { status: { in: ("SUBMITTED" | "VERIFICATION")[] } } }) => Promise<number> };
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function summaryLine(c: HomeCounts): string {
  const visible = [c.ordersToday, c.paymentsToConfirm, c.unreadMessages].filter((n): n is number => n !== null);
  if (visible.length === 0) return "Where do you want to work today?";
  const parts = [
    c.ordersToday ? plural(c.ordersToday, "order", "orders") : null,
    c.paymentsToConfirm ? plural(c.paymentsToConfirm, "payment to confirm", "payments to confirm") : null,
    c.unreadMessages ? plural(c.unreadMessages, "unread message", "unread messages") : null,
  ].filter(Boolean);
  if (parts.length === 0) return c.incomplete ? "Where do you want to work today?" : "Nothing waiting for you right now.";
  return `Across the network today: ${parts.join(", ")}.`;
}

const FAILED = Symbol("failed");

/** Runs one count only when allowed; a failure is logged and marked so the page still loads. */
async function maybe(allowed: boolean, run: () => Promise<number>): Promise<number | null | typeof FAILED> {
  if (!allowed) return null;
  try {
    return await run();
  } catch (error) {
    console.error("modules page: a home count failed", error);
    return FAILED;
  }
}

export async function loadHomeCounts(
  user: { id: string } & StaffUser,
  deps: { db?: CountDb; unread?: (userId: string) => Promise<number>; now?: Date } = {}
): Promise<HomeCounts> {
  const db = deps.db ?? ((await import("@/lib/prisma")).prisma as unknown as CountDb);
  const unread = deps.unread ?? (await import("@/lib/messaging/service")).unreadMessageCount;
  const since = nairobiTodayStart(deps.now ?? new Date());

  const results = await Promise.all([
    maybe(canUser(user, "orders", "view"), () => db.dealerOrder.count({ where: { createdAt: { gte: since } } })),
    maybe(canUser(user, "orders", "act"), () =>
      db.paymentRecord.count({ where: { status: { in: ["SUBMITTED", "VERIFICATION"] } } })
    ),
    maybe(canUser(user, "messaging", "view"), () => unread(user.id)),
  ]);
  const [ordersToday, paymentsToConfirm, unreadMessages] = results.map((r) => (r === FAILED ? null : r));
  return { ordersToday, paymentsToConfirm, unreadMessages, incomplete: results.includes(FAILED) };
}
