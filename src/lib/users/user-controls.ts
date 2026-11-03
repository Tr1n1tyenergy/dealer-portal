import { canUser, type StaffUser } from "@/lib/permissions";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";

/** Which controls the Users page shows: the server refuses the rest anyway, so the screen should not offer them. */
export function retailUsersControls(user: StaffUser | null | undefined): { invite: boolean; manage: boolean } {
  return { invite: canUser(user, "retailUsers", "act"), manage: canUser(user, "adminUsers", "act") };
}

/**
 * The buttons on one Admin → Users row, matching what the API accepts: nothing without Act on Admin users or on an
 * Admin's row for a non-Admin; Permissions only on staff rows; never Delete on your own row.
 */
export function adminRowActions(
  actor: StaffUser & { email?: string | null; id?: string },
  row: { role: string; accountType: string; email: string; id?: string },
): { toggle: boolean; resetInvite: boolean; permissions: boolean; delete: boolean } {
  // Same refusals as the API: no Act, or a non-Admin acting on an Admin (adminTargetRefusal in
  // admin-rules.ts, which can't be imported here: it loads Prisma and this runs in the browser).
  if (!canUser(actor, "adminUsers", "act") || (row.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN")) {
    return { toggle: false, resetInvite: false, permissions: false, delete: false };
  }
  return {
    toggle: true,
    resetInvite: true,
    permissions: row.accountType === "INTERNAL",
    delete: row.id !== actor.id && mayDeleteProtectedAdmin(actor.email ?? "", row.email),
  };
}
