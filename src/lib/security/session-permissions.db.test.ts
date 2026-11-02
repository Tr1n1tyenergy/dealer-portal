import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { JWT } from "next-auth/jwt";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "sessions carry the person's permission overrides",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let jwt: (args: { token: JWT }) => Promise<JWT>;
    const run = `sp${Date.now()}`;
    let userId = "";

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      const { authOptions } = await import("@/lib/auth");
      jwt = authOptions.callbacks!.jwt as unknown as typeof jwt;
      userId = (
        await prisma.user.create({
          data: {
            firstName: "T", lastName: "Perm", email: `perm.${run}@example.test`, department: "T",
            role: "SALES_PERSON_EXECUTIVE", status: "ACTIVE", passwordHash: "x",
            permissions: '{"orders.act":"deny"}',
          },
        })
      ).id;
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("puts the stored overrides in the token, and picks up a change on the next request", async () => {
      const first = await jwt({ token: { id: userId } as JWT });
      assert.equal(first.permissions, '{"orders.act":"deny"}');

      await prisma.user.update({ where: { id: userId }, data: { permissions: '{"settings.view":"allow"}' } });
      const next = await jwt({ token: first });
      assert.equal(next.permissions, '{"settings.view":"allow"}');
    });
  },
);
