import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "invite and reset links: the database keeps only a hash of the secret",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let hashToken: (raw: string) => string;
    const run = `lt${Date.now()}`;
    const ids: string[] = [];
    const PASSWORD = "Fresh-Pass-2026!x";
    const raw = (label: string) => `${label}${run}`.padEnd(64, "0");

    const post = (body: unknown) =>
      new Request("http://test.local/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    async function user(name: string, status: "PENDING" | "ACTIVE" = "PENDING") {
      const u = await prisma.user.create({
        data: { firstName: "T", lastName: name, email: `${name}.${run}@example.test`, department: "T", status },
      });
      ids.push(u.id);
      return u;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ hashToken } = await import("@/lib/tokens"));
    });

    after(async () => {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });

    it("stores the hash of the token it emails when an invite is resent", async () => {
      process.env.RESEND_API_KEY = "";
      process.env.TRI_ALLOW_DEV_EMAIL_SKIP = "1";
      const { resendInvite } = await import("@/lib/users/resend-invite");
      const u = await user("resend");
      const result = await resendInvite(u);
      assert.equal(result.ok, true);
      const emailed = new URL(result.ok ? result.activateUrl : "http://x").searchParams.get("token")!;
      const row = await prisma.invitationToken.findFirstOrThrow({ where: { userId: u.id } });
      assert.equal(row.token, hashToken(emailed));
      assert.notEqual(row.token, emailed);
    });

    it("activates with the emailed token when only its hash is stored", async () => {
      const { GET, POST } = await import("@/app/api/auth/activate/route");
      const u = await user("activate");
      const token = raw("act");
      await prisma.invitationToken.create({ data: { token: hashToken(token), userId: u.id, expiresAt: new Date(Date.now() + 86400e3) } });
      assert.equal((await GET(new Request(`http://test.local/api?token=${token}`))).status, 200);
      assert.equal((await POST(post({ token, password: PASSWORD }))).status, 200);
    });

    it("resets with the emailed token when only its hash is stored", async () => {
      const { POST } = await import("@/app/api/auth/reset-password/route");
      const u = await user("reset", "ACTIVE");
      const token = raw("rst");
      await prisma.passwordResetToken.create({ data: { token: hashToken(token), userId: u.id, expiresAt: new Date(Date.now() + 3600e3) } });
      assert.equal((await POST(post({ token, password: PASSWORD }))).status, 200);
    });

    it("never accepts a token found in plain text in the database", async () => {
      const { POST } = await import("@/app/api/auth/reset-password/route");
      const u = await user("plain", "ACTIVE");
      const token = raw("pln");
      await prisma.passwordResetToken.create({ data: { token, userId: u.id, expiresAt: new Date(Date.now() + 3600e3) } });
      assert.notEqual((await POST(post({ token, password: PASSWORD }))).status, 200);
    });
  }
);
