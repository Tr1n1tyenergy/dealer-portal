import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { JWT } from "next-auth/jwt";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "a password reset ends other sessions",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let jwt: (args: { token: JWT }) => Promise<JWT>;
    const run = `s${Date.now()}`;
    let userId = "";

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      const { authOptions } = await import("@/lib/auth");
      jwt = authOptions.callbacks!.jwt as unknown as typeof jwt;
      userId = (
        await prisma.user.create({
          data: { firstName: "T", lastName: "Reset", email: `reset.${run}@example.test`, department: "T", status: "ACTIVE", passwordHash: "x" },
        })
      ).id;
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("keeps a session while the password is unchanged", async () => {
      const token = await jwt({ token: { id: userId, loginAt: Date.now() - 60_000 } as JWT });
      assert.equal(token.error, undefined);
    });

    it("stamps the change time when the password is reset", async () => {
      const { POST } = await import("@/app/api/auth/reset-password/route");
      const reset = `rst-${run}-xxxxxxxxx`;
      await prisma.passwordResetToken.create({ data: { token: reset, userId, expiresAt: new Date(Date.now() + 3600e3) } });
      const res = await POST(
        new Request("http://test.local/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: reset, password: "Fresh-Pass-2026!x" }),
        }),
      );
      assert.equal(res.status, 200);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      assert.ok(user.passwordChangedAt, "passwordChangedAt is set");
    });

    it("ends a session that signed in before the reset", async () => {
      const token = await jwt({ token: { id: userId, loginAt: Date.now() - 60 * 60_000 } as JWT });
      assert.equal(token.error, "SessionRevoked");
    });
  },
);
