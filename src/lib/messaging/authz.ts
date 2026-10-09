import type { AccountType } from "@prisma/client";

/**
 * Who may start a direct conversation with whom.
 * - Staff may message any ACTIVE internal or dealer user (except self).
 * - Dealers may message ACTIVE internal staff and other dealers (not arbitrary closed circles).
 */
export function canMessageUser(params: {
  actorAccountType: AccountType;
  targetAccountType: AccountType;
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
