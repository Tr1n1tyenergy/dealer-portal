import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { DealerOrderStatus, PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "order transitions under concurrent requests",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    const run = `t${Date.now()}`;
    let actorId = "";
    let organizationId = "";
    let stationId = "";
    let depotId = "";
    let sequence = 0;

    async function createOrder(status: DealerOrderStatus) {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `TEST-${run}-${sequence}`,
          odooSyncKey: `test:${run}:${sequence}`,
          status,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: actorId,
        },
      });
    }

    function attemptsInParallel(count: number, attempt: () => Promise<unknown>) {
      return Promise.allSettled(Array.from({ length: count }, attempt));
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      const organization = await prisma.dealerOrganization.create({
        data: { name: `Test Dealer ${run}`, code: `TEST-${run}` },
      });
      organizationId = organization.id;
      stationId = (
        await prisma.station.create({ data: { name: "Test Station", dealerOrganizationId: organizationId } })
      ).id;
      depotId = (await prisma.depot.create({ data: { name: "Test Depot", code: `TEST-${run}` } })).id;
      actorId = (
        await prisma.user.create({
          data: {
            firstName: "Test",
            lastName: "Finance",
            email: `finance.${run}@example.test`,
            department: "Finance",
            role: "FINANCE",
            status: "ACTIVE",
          },
        })
      ).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.activityLog.deleteMany({ where: { actorId } });
      await prisma.user.delete({ where: { id: actorId } });
      await prisma.depot.delete({ where: { id: depotId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("confirms a payment once when five confirmations arrive together", async () => {
      const order = await createOrder("PAYMENT_VERIFICATION");

      const results = await attemptsInParallel(5, () => service.confirmPayment(order.id, actorId, true));

      const confirmations = await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: "PAYMENT_CONFIRMED" },
      });
      assert.equal(confirmations, 1);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    });

    it("releases an order to the depot once when five releases arrive together", async () => {
      const order = await createOrder("PAYMENT_CONFIRMED");

      const results = await attemptsInParallel(5, () => service.releaseToDepot(order.id, actorId, depotId));

      const releases = await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: "RELEASED_TO_DEPOT" },
      });
      assert.equal(releases, 1);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const saved = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(saved.status, "RELEASED_TO_DEPOT");
      assert.equal(saved.depotId, depotId);
    });

    it("creates one order when the same Place Order submission arrives twice", async () => {
      const submission = {
        actorId,
        dealerOrganizationId: organizationId,
        stationId,
        requestedDeliveryDate: "2026-10-20",
        dealerReference: `PO-${run}`,
        lines: [{ product: "PMS" as const, quantityLitres: 5000 }],
        submissionKey: `${run}-place-order`,
      };

      const results = await attemptsInParallel(2, () => service.submitDealerOrder(submission));

      const orders = await prisma.dealerOrder.count({ where: { dealerReference: submission.dealerReference } });
      assert.equal(orders, 1);
      const ids = results.map((r) => (r.status === "fulfilled" ? (r.value as { id: string }).id : "rejected"));
      assert.equal(ids[0], ids[1], "both submits should land on the same order");
    });
  }
);
