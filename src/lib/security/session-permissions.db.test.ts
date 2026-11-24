import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
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
    let adminId = "";

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
      adminId = (
        await prisma.user.create({
          data: {
            firstName: "T", lastName: "Admin", email: `permadmin.${run}@example.test`, department: "T",
            role: "SUPER_ADMIN", status: "ACTIVE", passwordHash: "x",
          },
        })
      ).id;
    });

    after(async () => {
      await prisma.activityLog.deleteMany({ where: { actorId: adminId } });
      await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
    });

    it("puts the stored overrides in the token, and a change made in the app applies at once on the same server", async () => {
      const first = await jwt({ token: { id: userId } as JWT });
      assert.equal(first.permissions, '{"orders.act":"deny"}');

      const { savePermissions } = await import("@/lib/users/permissions-admin");
      const saved = await savePermissions({ id: adminId, accountType: "INTERNAL", role: "SUPER_ADMIN", permissions: null }, userId, [
        { key: "settings.view", value: "allow" },
      ]);
      assert.equal(saved.ok, true);
      const stored = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).permissions;
      const next = await jwt({ token: first });
      assert.equal(next.permissions, stored);
      assert.match(String(next.permissions), /settings\.view/);
    });

    it("picks up a change made anywhere else (another server, a script) within 5 seconds", async () => {
      mock.timers.enable({ apis: ["Date"], now: Date.now() });
      try {
        const first = await jwt({ token: { id: userId } as JWT });
        await prisma.user.update({ where: { id: userId }, data: { permissions: '{"stock.view":"deny"}' } });
        mock.timers.tick(5_001);
        const next = await jwt({ token: first });
        assert.equal(next.permissions, '{"stock.view":"deny"}');
      } finally {
        mock.timers.reset();
      }
    });
  },
);
