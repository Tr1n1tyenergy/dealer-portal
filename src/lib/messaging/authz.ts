import type { AccountType } from "@prisma/client";
import { can } from "@/lib/access";

/** Staff roles that use messaging (Admin and Sales Person Executive). */
export const MESSAGING_STAFF_ROLES = ["SUPER_ADMIN", "SALES_PERSON_EXECUTIVE"] as const;

/** Dealers, Admins and Sales Person Executives use messaging; Staff Members and depots don't. */
export function canUseMessaging(
  accountType: AccountType | string | null | undefined,
  role: string | null | undefined
): boolean {
  if (accountType === "DEALER") return true;
  if (accountType === "INTERNAL") return can(role, "retail.messaging");
  return false;
}

/**
 * Who may start a direct conversation with whom.
 * - Admins and Sales Person Executives may message ACTIVE dealers and each other (not Staff Members).
 * - Dealers may message ACTIVE Admins, Sales Person Executives and other dealers.
 */
export function canMessageUser(params: {
  actorAccountType: AccountType;
  actorRole: string;
  targetAccountType: AccountType;
  targetRole: string;
  targetStatus: string;
  actorId: string;
  targetId: string;
}): { ok: true } | { ok: false; reason: string } {
  if (params.actorId === params.targetId) {
    return { ok: false, reason: "Cannot message yourself." };
  }
  if (params.targetStatus !== "ACTIVE") {
    return { ok: false, reason: "Target user is not active." };
  }
  if (!canUseMessaging(params.actorAccountType, params.actorRole)) {
    return { ok: false, reason: "Messaging is not available for this account type." };
  }
  if (params.targetAccountType === "INTERNAL" && !canUseMessaging("INTERNAL", params.targetRole)) {
    return { ok: false, reason: "This staff member doesn't use messaging." };
  }
  if (params.actorAccountType === "INTERNAL") {
    if (params.targetAccountType === "INTERNAL" || params.targetAccountType === "DEALER") {
      return { ok: true };
    }
    return { ok: false, reason: "Staff can only message staff or dealers." };
  }
  if (params.actorAccountType === "DEALER") {
    if (params.targetAccountType === "INTERNAL" || params.targetAccountType === "DEALER") {
      return { ok: true };
    }
    return { ok: false, reason: "Dealers can only message staff or dealers." };
  }
  return { ok: false, reason: "Messaging is not available for this account type." };
}
