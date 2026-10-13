import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "depot actions are limited to the manager's own depot",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    const run = `d${Date.now()}`;
    let organizationId = "";
    let stationId = "";
    let ownDepotId = "";
    let otherDepotId = "";
    let creatorId = "";
    const managers: Record<string, { id: string; role: string; depotId: string | null }> = {};
    let sequence = 0;

    async function releasedOrder(depotId: string) {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `TEST-${run}-${sequence}`,
          odooSyncKey: `test:${run}:${sequence}`,
          status: "RELEASED_TO_DEPOT",
          depotId,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: creatorId,
        },
      });
    }

    async function user(name: string, role: "DEPOT_MANAGER" | "SUPER_ADMIN", depotId: string | null) {
      const created = await prisma.user.create({
        data: {
          firstName: "Test",
          lastName: name,
          email: `${name}.${run}@example.test`,
          department: "Operations",
          role,
          accountType: role === "SUPER_ADMIN" ? "INTERNAL" : "DEPOT",
          status: "ACTIVE",
          depotId,
        },
      });
      return { id: created.id, role, depotId };
    }

    async function statusOf(orderId: string) {
      return (await prisma.dealerOrder.findUniqueOrThrow({ where: { id: orderId } })).status;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      organizationId = (
        await prisma.dealerOrganization.create({ data: { name: `Test Dealer ${run}`, code: `TEST-${run}` } })
      ).id;
      stationId = (
        await prisma.station.create({ data: { name: "Test Station", dealerOrganizationId: organizationId } })
      ).id;
      ownDepotId = (await prisma.depot.create({ data: { name: "Own Depot", code: `OWN-${run}` } })).id;
      otherDepotId = (await prisma.depot.create({ data: { name: "Other Depot", code: `OTHER-${run}` } })).id;
      managers.own = await user("own", "DEPOT_MANAGER", ownDepotId);
      managers.unassigned = await user("unassigned", "DEPOT_MANAGER", null);
      managers.admin = await user("admin", "SUPER_ADMIN", null);
      creatorId = managers.admin.id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      const ids = Object.values(managers).map((m) => m.id);
      await prisma.activityLog.deleteMany({ where: { actorId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.depot.deleteMany({ where: { id: { in: [ownDepotId, otherDepotId] } } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("starts loading an order released to the manager's own depot", async () => {
      const order = await releasedOrder(ownDepotId);

      await service.applyDepotAction(order.id, managers.own, "accept", {});

      assert.equal(await statusOf(order.id), "LOADING");
    });

    it("refuses an order released to another depot and leaves it unchanged", async () => {
      const order = await releasedOrder(otherDepotId);

      await assert.rejects(service.applyDepotAction(order.id, managers.own, "accept", {}), /Order not found/);

      assert.equal(await statusOf(order.id), "RELEASED_TO_DEPOT");
    });

    it("refuses a depot manager who has no depot assigned", async () => {
      const order = await releasedOrder(ownDepotId);

      await assert.rejects(service.applyDepotAction(order.id, managers.unassigned, "accept", {}), /Order not found/);

      assert.equal(await statusOf(order.id), "RELEASED_TO_DEPOT");
    });

    it("lets a super admin act on any depot's order", async () => {
      const order = await releasedOrder(otherDepotId);

      await service.applyDepotAction(order.id, managers.admin, "accept", {});

      assert.equal(await statusOf(order.id), "LOADING");
    });
  }
);
