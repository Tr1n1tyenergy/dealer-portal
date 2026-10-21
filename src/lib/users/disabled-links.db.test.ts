import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "disabled accounts stay disabled",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    const run = `d${Date.now()}`;
    const ids: string[] = [];
    const NEW_PASSWORD = "Fresh-Pass-2026!x";

    const post = (body: unknown) =>
      new Request("http://test.local/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    async function disabledUser(name: string) {
      const user = await prisma.user.create({
        data: { firstName: "T", lastName: name, email: `${name}.${run}@example.test`, department: "T", status: "DISABLED" },
      });
      ids.push(user.id);
      return user;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });

    it("refuses an invite link for a disabled account", async () => {
      const { POST } = await import("@/app/api/auth/activate/route");
      const user = await disabledUser("invited");
      const token = `inv-${run}-xxxxxxxx`;
      await prisma.invitationToken.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 86400e3) } });

      const res = await POST(post({ token, password: NEW_PASSWORD }));

      assert.equal(res.status, 400);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(after.status, "DISABLED");
      assert.equal(after.passwordHash, null);
    });

    it("refuses a password-reset link for a disabled account", async () => {
      const { POST } = await import("@/app/api/auth/reset-password/route");
      const user = await disabledUser("reset");
      const token = `rst-${run}-xxxxxxxx`;
      await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });

      const res = await POST(post({ token, password: NEW_PASSWORD }));

      assert.equal(res.status, 400);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(after.status, "DISABLED");
    });

    it("removes a person's open links when they are disabled", async () => {
      const { revokeOpenLinks } = await import("./admin-rules");
      const user = await disabledUser("revoked");
      await prisma.invitationToken.create({ data: { token: `inv2-${run}-xxxxxxx`, userId: user.id, expiresAt: new Date(Date.now() + 86400e3) } });
      await prisma.passwordResetToken.create({ data: { token: `rst2-${run}-xxxxxxx`, userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });

      await revokeOpenLinks(user.id);

      assert.equal(await prisma.invitationToken.count({ where: { userId: user.id } }), 0);
      assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), 0);
    });
  },
);
