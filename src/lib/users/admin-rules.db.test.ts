import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "admin user rules",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let rules: typeof import("./admin-rules");
    const run = `u${Date.now()}`;
    let sequence = 0;
    let organizationId = "";
    let stationId = "";
    const created: string[] = [];

    async function user(data: {
      role?: "SUPER_ADMIN" | "STANDARD_USER" | "DEALER_ADMIN" | "DEALER_USER";
      accountType?: "INTERNAL" | "DEALER";
      status?: "ACTIVE" | "PENDING" | "DISABLED";
      dealerOrganizationId?: string | null;
      permissions?: string;
    }) {
      sequence += 1;
      const u = await prisma.user.create({
        data: {
          firstName: "Test",
          lastName: `${sequence}`,
          email: `user${sequence}.${run}@example.test`,
          department: "Test",
          role: data.role ?? "STANDARD_USER",
          accountType: data.accountType ?? "INTERNAL",
          status: data.status ?? "ACTIVE",
          dealerOrganizationId: data.dealerOrganizationId ?? null,
          permissions: data.permissions,
        },
      });
      created.push(u.id);
      return u;
    }

    // The test database may hold other super admins; park them so "last admin" is real here.
    let parked: string[] = [];

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      rules = await import("./admin-rules");
      organizationId = (
        await prisma.dealerOrganization.create({ data: { name: `Test Co ${run}`, code: `CO-${run}` } })
      ).id;
      stationId = (await prisma.station.create({ data: { name: "Test Station", dealerOrganizationId: organizationId } })).id;
      parked = (
        await prisma.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } })
      ).map((u) => u.id);
      await prisma.user.updateMany({ where: { id: { in: parked } }, data: { status: "PENDING" } });
    });

    after(async () => {
      await prisma.user.updateMany({ where: { id: { in: parked } }, data: { status: "ACTIVE" } });
      await prisma.message.deleteMany({ where: { senderId: { in: created } } });
      await prisma.conversation.deleteMany({ where: { directKey: { startsWith: `k-${run}` } } });
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: created } } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("refuses to demote, disable or delete the last active super admin", async () => {
      const admin = await user({ role: "SUPER_ADMIN" });

      for (const change of [{ role: "STANDARD_USER" }, { status: "DISABLED" }, { deleting: true }]) {
        const refusal = await rules.lastSuperAdminRefusal(admin, change);
        assert.equal(refusal?.status, 400, JSON.stringify(change));
      }
    });

    it("allows changing a super admin while another active one exists", async () => {
      const admin = await user({ role: "SUPER_ADMIN" });
      await user({ role: "SUPER_ADMIN" });

      assert.equal(await rules.lastSuperAdminRefusal(admin, { role: "STANDARD_USER" }), null);
    });

    it("ignores edits that keep the super admin active", async () => {
      const admin = await user({ role: "SUPER_ADMIN" });

      assert.equal(await rules.lastSuperAdminRefusal(admin, { status: "ACTIVE" }), null);
    });

    it("counts only Admins who still have Act on Admin Users", async () => {
      // Park the Admins earlier tests left active, so these two are the only ones.
      await prisma.user.updateMany({ where: { id: { in: created }, role: "SUPER_ADMIN" }, data: { status: "PENDING" } });
      await user({ role: "SUPER_ADMIN", permissions: '{"adminUsers.act":"deny"}' });
      const lastAbleAdmin = await user({ role: "SUPER_ADMIN" });

      for (const change of [{ role: "STANDARD_USER" }, { status: "DISABLED" }, { deleting: true }]) {
        const refusal = await rules.lastSuperAdminRefusal(lastAbleAdmin, change);
        assert.equal(refusal?.status, 400, JSON.stringify(change));
      }
    });

    it("lets only an Admin change an Admin account", async () => {
      const admin = await user({ role: "SUPER_ADMIN" });
      const staff = await user({});
      assert.equal(rules.adminTargetRefusal({ role: "SALES_PERSON_EXECUTIVE" }, admin)?.status, 403);
      assert.equal(rules.adminTargetRefusal({ role: "SUPER_ADMIN" }, admin), null);
      assert.equal(rules.adminTargetRefusal({ role: "SALES_PERSON_EXECUTIVE" }, staff), null);
    });

    it("refuses to delete a user who placed orders", async () => {
      const dealer = await user({ role: "DEALER_ADMIN", accountType: "DEALER", dealerOrganizationId: organizationId });
      await prisma.dealerOrder.create({
        data: {
          reference: `TEST-${run}-${sequence}`,
          odooSyncKey: `test:${run}:${sequence}`,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: dealer.id,
        },
      });

      const refusal = await rules.historyRefusal(dealer.id);

      assert.equal(refusal?.status, 409);
      assert.equal(refusal?.message, "This user has order or message history — disable the account instead.");
    });

    it("refuses to delete a user who sent messages", async () => {
      const sender = await user({});
      const conversation = await prisma.conversation.create({ data: { kind: "DIRECT", directKey: `k-${run}-${sequence}` } });
      await prisma.message.create({ data: { conversationId: conversation.id, senderId: sender.id, body: "hello" } });

      assert.equal((await rules.historyRefusal(sender.id))?.status, 409);
    });

    it("allows deleting a user with no history", async () => {
      const fresh = await user({ status: "PENDING" });

      assert.equal(await rules.historyRefusal(fresh.id), null);
    });

    it("refuses to re-enable a second dealer login for the same company", async () => {
      const company = await prisma.dealerOrganization.create({ data: { name: `Pair ${run}`, code: `PAIR-${run}` } });
      const live = await user({ role: "DEALER_ADMIN", accountType: "DEALER", dealerOrganizationId: company.id });
      const second = await user({ role: "DEALER_USER", accountType: "DEALER", status: "DISABLED", dealerOrganizationId: company.id });

      const refusal = await rules.dealerLoginRefusal(second, "ACTIVE");

      assert.equal(refusal?.status, 409);
      assert.equal(refusal?.message, `Pair ${run} already has a dealer login (${live.email}). Disable it before enabling another.`);

      await prisma.user.deleteMany({ where: { id: { in: [live.id, second.id] } } });
      created.splice(created.indexOf(live.id), 1);
      created.splice(created.indexOf(second.id), 1);
      await prisma.dealerOrganization.delete({ where: { id: company.id } });
    });

    it("allows re-enabling a dealer login when it is the company's only one", async () => {
      const otherOrg = await prisma.dealerOrganization.create({ data: { name: `Solo ${run}`, code: `SOLO-${run}` } });
      const only = await user({ role: "DEALER_ADMIN", accountType: "DEALER", status: "DISABLED", dealerOrganizationId: otherOrg.id });

      assert.equal(await rules.dealerLoginRefusal(only, "ACTIVE"), null);

      await prisma.user.delete({ where: { id: only.id } });
      created.splice(created.indexOf(only.id), 1);
      await prisma.dealerOrganization.delete({ where: { id: otherOrg.id } });
    });

    it("leaves dealer logins alone when they are being disabled", async () => {
      const dealer = await user({ role: "DEALER_ADMIN", accountType: "DEALER", dealerOrganizationId: organizationId });

      assert.equal(await rules.dealerLoginRefusal(dealer, "DISABLED"), null);
    });
  }
);
