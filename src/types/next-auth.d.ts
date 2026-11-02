import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      department: string;
      firstName: string;
      lastName: string;
      accountType: string;
      dealerOrganizationId: string | null;
      depotId: string | null;
      /** The person's Allow/Deny overrides (raw User.permissions); see src/lib/permissions.ts. */
      permissions: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    department?: string;
    firstName?: string;
    lastName?: string;
    accountType?: string;
    dealerOrganizationId?: string | null;
    depotId?: string | null;
    permissions?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    department?: string;
    firstName?: string;
    lastName?: string;
    accountType?: string;
    dealerOrganizationId?: string | null;
    depotId?: string | null;
    permissions?: string;
  }
}
