import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "modules page counts: orders today and payments waiting, from the real database",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let summary: typeof import("./summary");
    const run = `mh${Date.now()}`;
    let organizationId = "";
    let stationId = "";
    let adminId = "";

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      summary = await import("./summary");
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `Home Dealer ${run}`, code: `MH-${run}` } })).id;
      stationId = (await prisma.station.create({ data: { code: `mh-${run}`, name: "Home Station", dealerOrganizationId: organizationId } })).id;
      adminId = (
        await prisma.user.create({
          data: { firstName: "Test", lastName: "Admin", email: `admin.${run}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", department: "Operations" },
        })
      ).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.user.deleteMany({ where: { id: adminId } });
      await prisma.station.delete({ where: { id: stationId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
    });

    function order(n: number, createdAt: Date) {
      return prisma.dealerOrder.create({
        data: {
          reference: `MH-${run}-${n}`,
          odooSyncKey: `mh:${run}:${n}`,
          status: "AWAITING_PAYMENT",
          amountDue: "1000.00",
          dealerOrganizationId: organizationId,
          stationId,
          createdById: adminId,
          createdAt,
        },
      });
    }

    it("counts today's orders and waiting payments only", async () => {
      const admin = { id: adminId, accountType: "INTERNAL", role: "SUPER_ADMIN", permissions: null };
      const beforeCounts = await summary.loadHomeCounts(admin);

      const today = await order(1, new Date());
      await order(2, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
      await prisma.paymentRecord.createMany({
        data: [
          { orderId: today.id, amount: "100.00", status: "SUBMITTED" },
          { orderId: today.id, amount: "200.00", status: "VERIFICATION" },
          { orderId: today.id, amount: "300.00", status: "CONFIRMED" },
        ],
      });

      const afterCounts = await summary.loadHomeCounts(admin);
      assert.equal(afterCounts.ordersToday, (beforeCounts.ordersToday ?? 0) + 1);
      assert.equal(afterCounts.paymentsToConfirm, (beforeCounts.paymentsToConfirm ?? 0) + 2);
      assert.equal(typeof afterCounts.unreadMessages, "number");
    });
  }
);
