import { canUser, type StaffUser } from "@/lib/permissions";
import { mayDeleteProtectedAdmin } from "@/lib/security/protected-admins";

/** Which controls the Users page shows: the server refuses the rest anyway, so the screen should not offer them. */
export function retailUsersControls(user: StaffUser | null | undefined): { invite: boolean; manage: boolean } {
  return { invite: canUser(user, "retailUsers", "act"), manage: canUser(user, "adminUsers", "act") };
}

/**
 * The buttons on one Admin → Users row. Nothing without Act on Admin users; Permissions only on staff rows,
 * and on an Admin's row only for Admins (the server refuses the rest, permissions-admin.ts).
 */
export function adminRowActions(
  actor: StaffUser & { email?: string | null },
  row: { role: string; accountType: string; email: string },
): { toggle: boolean; resetInvite: boolean; permissions: boolean; delete: boolean } {
  if (!canUser(actor, "adminUsers", "act")) return { toggle: false, resetInvite: false, permissions: false, delete: false };
  return {
    toggle: true,
    resetInvite: true,
    permissions: row.accountType === "INTERNAL" && (row.role !== "SUPER_ADMIN" || actor.role === "SUPER_ADMIN"),
    delete: mayDeleteProtectedAdmin(actor.email ?? "", row.email),
  };
}
