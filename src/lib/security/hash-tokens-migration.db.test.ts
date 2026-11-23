import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

const MIGRATION = "prisma/migrations/20261120130000_hash_login_tokens/migration.sql";

describe(
  "migration: links emailed before the switch to hashes keep working",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let hashToken: (raw: string) => string;
    const run = `hm${Date.now()}`;
    const ids: string[] = [];

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ hashToken } = await import("@/lib/tokens"));
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });

    it("turns plain tokens into their hashes, and the old link still activates", async () => {
      const user = await prisma.user.create({
        data: { firstName: "T", lastName: "Old", email: `old.${run}@example.test`, department: "T", status: "PENDING" },
      });
      ids.push(user.id);
      const invite = `inv${run}`.padEnd(64, "a");
      const reset = `rst${run}`.padEnd(64, "b");
      await prisma.invitationToken.create({ data: { token: invite, userId: user.id, expiresAt: new Date(Date.now() + 86400e3) } });
      await prisma.passwordResetToken.create({ data: { token: reset, userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });

      // Only touch this test's rows: the migration's statements, narrowed to this user.
      for (const statement of readFileSync(MIGRATION, "utf8").replace(/^--.*$/gm, "").split(";").map((s) => s.trim()).filter((s) => /^UPDATE/i.test(s))) {
        await prisma.$executeRawUnsafe(`${statement} WHERE "userId" = $1`, user.id);
      }

      assert.equal((await prisma.invitationToken.findFirstOrThrow({ where: { userId: user.id } })).token, hashToken(invite));
      assert.equal((await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } })).token, hashToken(reset));

      const { GET } = await import("@/app/api/auth/activate/route");
      assert.equal((await GET(new Request(`http://test.local/api?token=${invite}`))).status, 200);
    });
  }
);
