import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { beginLoginAttempt, clearLoginFailures, normalizeEmail } from "@/lib/security/auth-throttle";
import { clientIp } from "@/lib/security/client-ip";
import { lockedError } from "@/lib/security/login-errors";
import { SESSION_MAX_AGE_SECONDS, signedInAfterPasswordChange } from "@/lib/security/session-length";

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
    passwordChangedAt: user.passwordChangedAt,
  };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
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

        // Recorded as a failure up front, so a burst of parallel guesses can't slip past the limit.
        // While locked even the right password is refused, so a lucky guess isn't revealed.
        const ip = clientIp(req?.headers);
        const lock = await beginLoginAttempt(email, ip);
        if (lock.locked) throw new Error(lockedError(lock.retryAfterSeconds));

        // Check the password before anything else so every refusal takes the same time.
        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user?.passwordHash || !valid) return null;
        if (user.status === "DISABLED" || user.status === "PENDING") return null;

        const portalAccount =
          portal === "dealer" ? "DEALER" : portal === "depot" ? "DEPOT" : "INTERNAL";
        if (user.accountType !== portalAccount) return null;

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
        // When this sign-in happened; NextAuth refreshes iat on every request, so it can't tell us.
        token.loginAt = Date.now();
        delete token.error;
        return token;
      }

      // Re-validate role/status on subsequent JWT access so disables/role changes take effect
      if (token.id && typeof token.id === "string") {
        try {
          const fresh = await hydrateTokenFromUser(token.id);
          if (!fresh || !signedInAfterPasswordChange(token.loginAt as number | undefined, fresh.passwordChangedAt)) {
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
