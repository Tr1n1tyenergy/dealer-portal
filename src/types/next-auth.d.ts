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
  }
}
