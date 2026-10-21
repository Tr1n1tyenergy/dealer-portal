import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "resend invite",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let resendInvite: typeof import("./resend-invite").resendInvite;
    const run = `r${Date.now()}`;
    const ids: string[] = [];
    const env = { key: process.env.RESEND_API_KEY, skip: process.env.TRI_ALLOW_DEV_EMAIL_SKIP };

    async function user(name: string, accountType: "INTERNAL" | "DEALER" | "DEPOT") {
      const u = await prisma.user.create({
        data: {
          firstName: "T",
          lastName: name,
          email: `${name}.${run}@example.test`,
          department: "T",
          accountType,
          status: "ACTIVE",
          passwordHash: "existing-hash",
        },
      });
      ids.push(u.id);
      return u;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ resendInvite } = await import("./resend-invite"));
    });

    after(async () => {
      process.env.RESEND_API_KEY = env.key;
      process.env.TRI_ALLOW_DEV_EMAIL_SKIP = env.skip;
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });

    it("changes nothing when the email can't be sent", async () => {
      process.env.RESEND_API_KEY = "";
      delete process.env.TRI_ALLOW_DEV_EMAIL_SKIP; // sendEmail now throws, like a provider outage
      const u = await user("failing", "INTERNAL");

      const result = await resendInvite(u);

      assert.equal(result.ok, false);
      assert.equal(result.ok ? 0 : result.status, 503, "an email failure is temporary");
      const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(after.passwordHash, "existing-hash");
      assert.equal(after.status, "ACTIVE");
      assert.equal(await prisma.invitationToken.count({ where: { userId: u.id } }), 0);
    });

    it("sends dealers the dealer activation link, then resets the account and keeps one live link", async () => {
      process.env.RESEND_API_KEY = "";
      process.env.TRI_ALLOW_DEV_EMAIL_SKIP = "1"; // sendEmail succeeds without a provider
      const u = await user("dealer", "DEALER");
      await prisma.invitationToken.create({ data: { token: `old-${run}-xxxxxxx`, userId: u.id, expiresAt: new Date(Date.now() + 86400e3) } });

      const result = await resendInvite(u);

      assert.equal(result.ok, true);
      assert.match(result.ok ? result.activateUrl : "", /\/dealer\/activate\?token=/);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(after.passwordHash, null);
      assert.equal(after.status, "PENDING");
      const tokens = await prisma.invitationToken.findMany({ where: { userId: u.id } });
      assert.equal(tokens.length, 1, "only the new link stays live");
      assert.notEqual(tokens[0].token, `old-${run}-xxxxxxx`);
    });

    it("sends staff the staff activation link", async () => {
      process.env.TRI_ALLOW_DEV_EMAIL_SKIP = "1";
      const result = await resendInvite(await user("staff", "INTERNAL"));
      assert.match(result.ok ? result.activateUrl : "", /\/intelligence\/activate\?token=/);
    });

    it("refuses depot accounts, which have no activation page", async () => {
      process.env.TRI_ALLOW_DEV_EMAIL_SKIP = "1";
      const u = await user("depot", "DEPOT");
      const result = await resendInvite(u);
      assert.equal(result.ok, false);
      assert.equal(result.ok ? 0 : result.status, 400, "retrying will never work for a depot account");
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash, "existing-hash");
    });
  },
);
