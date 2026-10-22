import type { AccountType } from "@prisma/client";
import { canUser } from "@/lib/permissions";

type MessagingParty = { accountType?: AccountType | string | null; role?: string | null; permissions?: string | null };

/** Dealers use messaging; staff need View on Messaging (role default + their ticks); depots don't. */
export function canUseMessaging(user: MessagingParty): boolean {
  if (user.accountType === "DEALER") return true;
  return canUser(user, "messaging", "view");
}

/**
 * Who may talk to whom: a dealer with staff who use messaging, or two such staff. Never two
 * dealers. Applies to existing chats too.
 */
export function messagingPairAllowed(a: MessagingParty, b: MessagingParty): boolean {
  if (!canUseMessaging(a) || !canUseMessaging(b)) return false;
  return a.accountType === "INTERNAL" || b.accountType === "INTERNAL";
}

/**
 * Who may start a direct conversation with whom.
 * - Staff with Act on Messaging may message ACTIVE dealers and other messaging staff.
 * - Dealers may message ACTIVE staff who use messaging.
 */
export function canMessageUser(params: {
  actor: MessagingParty & { id: string };
  target: MessagingParty & { id: string; status: string };
}): { ok: true } | { ok: false; reason: string } {
  const { actor, target } = params;
  if (actor.id === target.id) return { ok: false, reason: "Cannot message yourself." };
  if (target.status !== "ACTIVE") return { ok: false, reason: "Target user is not active." };
  if (!canUseMessaging(actor)) return { ok: false, reason: "Messaging is not available for this account type." };
  if (actor.accountType === "INTERNAL" && !canUser(actor, "messaging", "act")) {
    return { ok: false, reason: "You can read messages but not start chats." };
  }
  if (target.accountType === "INTERNAL" && !canUseMessaging(target)) {
    return { ok: false, reason: "This staff member doesn't use messaging." };
  }
  if (actor.accountType === "INTERNAL") {
    return target.accountType === "INTERNAL" || target.accountType === "DEALER"
      ? { ok: true }
      : { ok: false, reason: "Staff can only message staff or dealers." };
  }
  if (actor.accountType === "DEALER") {
    return target.accountType === "INTERNAL" ? { ok: true } : { ok: false, reason: "Dealers can only message Trinity staff." };
  }
  return { ok: false, reason: "Messaging is not available for this account type." };
}
