import { roleLabel } from "@/lib/access";

export type SearchableUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accountType: string;
  department: string;
  organization: string;
};

/** Whether a user matches a lower-cased search query on the Retail Users page. */
export function matchesUserQuery(user: SearchableUser, q: string): boolean {
  if (!q) return true;
  const hay = [user.firstName, user.lastName, user.email, user.role, roleLabel(user.role), user.accountType, user.department, user.organization]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
