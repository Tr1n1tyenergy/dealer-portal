import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { DealerOrderStatus, PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "order service refuses bad input",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    let rules: typeof import("./order-input");
    const run = `v${Date.now()}`;
    let organizationId = "";
    let stationId = "";
    let depotId = "";
    let actorId = "";
    let sequence = 0;

    async function order(status: DealerOrderStatus) {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `TEST-${run}-${sequence}`,
          odooSyncKey: `test:${run}:${sequence}`,
          status,
          depotId,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: actorId,
        },
      });
    }

    function submit(extra: { quantity?: number; date?: string | null; reference: string }) {
      process.env.TRI_ALLOW_MOCK_DEALER_ORDERS = "1";
      return service.submitDealerOrder({
        actorId,
        dealerOrganizationId: organizationId,
        stationId,
        requestedDeliveryDate: extra.date ?? null,
        dealerReference: extra.reference,
        lines: [{ product: "PMS", quantityLitres: extra.quantity ?? 5000 }],
      });
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      rules = await import("./order-input");
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `Test ${run}`, code: `T-${run}` } })).id;
      stationId = (await prisma.station.create({ data: { name: "Test Station", dealerOrganizationId: organizationId } })).id;
      depotId = (await prisma.depot.create({ data: { name: "Test Depot", code: `D-${run}` } })).id;
      actorId = (
        await prisma.user.create({
          data: { firstName: "T", lastName: "U", email: `u.${run}@example.test`, department: "T", role: "SUPER_ADMIN", status: "ACTIVE", dealerOrganizationId: organizationId },
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

    it("submitDealerOrder refuses 100,001 litres", async () => {
      await assert.rejects(submit({ quantity: 100_001, reference: `BIG-${run}` }), rules.OrderInputError);
      assert.equal(await prisma.dealerOrder.count({ where: { dealerReference: `BIG-${run}` } }), 0);
    });

    it("submitDealerOrder refuses a past delivery date", async () => {
      await assert.rejects(submit({ date: "2001-01-01", reference: `PAST-${run}` }), rules.OrderInputError);
      assert.equal(await prisma.dealerOrder.count({ where: { dealerReference: `PAST-${run}` } }), 0);
    });

    it("submitPayment refuses a non-numeric amount and keeps no record", async () => {
      const o = await order("AWAITING_PAYMENT");

      await assert.rejects(
        service.submitPayment({ orderId: o.id, actorId, dealerOrganizationId: organizationId, amount: "-999999abc" }),
        rules.OrderInputError
      );

      assert.equal(await prisma.paymentRecord.count({ where: { orderId: o.id } }), 0);
      assert.equal((await prisma.dealerOrder.findUniqueOrThrow({ where: { id: o.id } })).status, "AWAITING_PAYMENT");
    });

    it("submitPayment stores the amount normalised", async () => {
      const o = await order("AWAITING_PAYMENT");

      await service.submitPayment({ orderId: o.id, actorId, dealerOrganizationId: organizationId, amount: "1,070,150" });

      const record = await prisma.paymentRecord.findFirstOrThrow({ where: { orderId: o.id } });
      assert.equal(record.amount, "1070150.00");
    });

    it("applyDepotAction refuses another depot's order as an input error", async () => {
      const o = await order("RELEASED_TO_DEPOT");
      const otherDepot = { id: actorId, role: "DEPOT_MANAGER", depotId: "some-other-depot" };

      await assert.rejects(service.applyDepotAction(o.id, otherDepot, "accept", {}), rules.OrderInputError);
    });

    it("applyDepotAction refuses loaded litres over 100,000 or negative", async () => {
      const o = await order("RELEASED_TO_DEPOT");
      const admin = { id: actorId, role: "SUPER_ADMIN", depotId: null };
      await service.applyDepotAction(o.id, admin, "accept", {});

      for (const loadedPmsLitres of [3_000_000_000, -500]) {
        await assert.rejects(service.applyDepotAction(o.id, admin, "complete", { loadedPmsLitres }), rules.OrderInputError);
      }
      assert.equal((await prisma.dealerOrder.findUniqueOrThrow({ where: { id: o.id } })).status, "LOADING");
    });

    it("applyDepotAction refuses an unknown action", async () => {
      const o = await order("RELEASED_TO_DEPOT");

      await assert.rejects(
        service.applyDepotAction(o.id, { id: actorId, role: "SUPER_ADMIN", depotId: null }, "bogus" as "accept", {}),
        (e: unknown) => e instanceof rules.OrderInputError && e.message === "Unknown depot action."
      );

      assert.equal((await prisma.dealerOrder.findUniqueOrThrow({ where: { id: o.id } })).status, "RELEASED_TO_DEPOT");
    });
  }
);
