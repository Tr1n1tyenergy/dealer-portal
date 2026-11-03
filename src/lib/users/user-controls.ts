import { canUser, type StaffUser } from "@/lib/permissions";

/** Which controls the Users page shows: the server refuses the rest anyway, so the screen should not offer them. */
export function retailUsersControls(user: StaffUser | null | undefined): { invite: boolean; manage: boolean } {
  return { invite: canUser(user, "retailUsers", "act"), manage: canUser(user, "adminUsers", "act") };
}
