import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  checkLoginLock,
  clearLoginFailures,
  normalizeEmail,
  recordLoginFailure,
} from "@/lib/security/auth-throttle";
import { clientIp } from "@/lib/security/client-ip";
import { lockedError } from "@/lib/security/login-errors";

/** Compared against when there is no real hash, so every refusal takes about as long as a real check. */
// Cost-12 bcrypt hash of a random throwaway string (matches real hashes); precomputed to keep cold starts fast.
const DUMMY_HASH = "$2b$12$/It9sYuAHtJEye3YXjINqeM2LnwnY5fDT.mI5bRv4PWzD.jGMuC3q";

async function hydrateTokenFromUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || user.status === "DISABLED" || user.status === "PENDING") {
    return null;
  }
  return {
    id: user.id,
    role: user.role,
    department: user.department,
    firstName: user.firstName,
    lastName: user.lastName,
    accountType: user.accountType,
    dealerOrganizationId: user.dealerOrganizationId,
    depotId: user.depotId,
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/access",
    error: "/access",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        portal: { label: "Portal", type: "text" },
      },
      async authorize(credentials, req) {
        const email = normalizeEmail(credentials?.email ?? "");
        const password = credentials?.password;
        const portal = credentials?.portal || "staff";

        if (!email || !password) return null;

        // Lock first: while locked even the right password is refused, so a lucky guess isn't revealed.
        const ip = clientIp(req?.headers);
        const lock = await checkLoginLock(email, ip);
        if (lock.locked) throw new Error(lockedError(lock.retryAfterSeconds));

        const refuse = async () => {
          await recordLoginFailure(email, ip);
          return null;
        };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return refuse();
        }
        if (user.status === "DISABLED" || user.status === "PENDING") return refuse();

        const portalAccount =
          portal === "dealer" ? "DEALER" : portal === "depot" ? "DEPOT" : "INTERNAL";
        if (user.accountType !== portalAccount) return refuse();

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return refuse();

        await clearLoginFailures(email);

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await logActivity({
          actorId: user.id,
          action: "USER_LOGIN",
          entity: "User",
          entityId: user.id,
          meta: { portal },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          department: user.department,
          firstName: user.firstName,
          lastName: user.lastName,
          accountType: user.accountType,
          dealerOrganizationId: user.dealerOrganizationId,
          depotId: user.depotId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.department = (user as { department?: string }).department;
        token.firstName = (user as { firstName?: string }).firstName;
        token.lastName = (user as { lastName?: string }).lastName;
        token.accountType = (user as { accountType?: string }).accountType;
        token.dealerOrganizationId = (
          user as { dealerOrganizationId?: string | null }
        ).dealerOrganizationId;
        token.depotId = (user as { depotId?: string | null }).depotId;
        delete token.error;
        return token;
      }

      // Re-validate role/status on subsequent JWT access so disables/role changes take effect
      if (token.id && typeof token.id === "string") {
        try {
          const fresh = await hydrateTokenFromUser(token.id);
          if (!fresh) {
            return { ...token, error: "SessionRevoked" };
          }
          token.role = fresh.role;
          token.department = fresh.department;
          token.firstName = fresh.firstName;
          token.lastName = fresh.lastName;
          token.accountType = fresh.accountType;
          token.dealerOrganizationId = fresh.dealerOrganizationId;
          token.depotId = fresh.depotId;
          delete token.error;
        } catch {
          // Keep prior token claims if DB is briefly unreachable
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error === "SessionRevoked") {
        return { expires: session.expires } as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.department = token.department as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.accountType = (token.accountType as string) || "INTERNAL";
        session.user.dealerOrganizationId =
          (token.dealerOrganizationId as string | null) ?? null;
        session.user.depotId = (token.depotId as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
