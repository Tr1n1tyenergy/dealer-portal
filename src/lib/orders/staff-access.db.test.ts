import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "staff roles on dealer orders",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let core: typeof import("./internal-order-actions");
    const run = `s${Date.now()}`;
    let organizationId = "";
    let stationId = "";
    let depotId = "";
    const users: Record<"staff" | "spe" | "dealer", string> = { staff: "", spe: "", dealer: "" };
    let sequence = 0;

    function form(fields: Record<string, string>) {
      const data = new FormData();
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      return data;
    }

    async function orderAwaitingVerification() {
      sequence += 1;
      const order = await prisma.dealerOrder.create({
        data: {
          reference: `TEST-${run}-${sequence}`,
          odooSyncKey: `test:${run}:${sequence}`,
          status: "PAYMENT_VERIFICATION",
          depotId,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: users.spe,
        },
      });
      await prisma.paymentRecord.create({ data: { orderId: order.id, amount: "1000.00", status: "VERIFICATION" } });
      return order;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      core = await import("./internal-order-actions");
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `Test ${run}`, code: `T-${run}` } })).id;
      stationId = (await prisma.station.create({ data: { name: "Test Station", dealerOrganizationId: organizationId } })).id;
      depotId = (await prisma.depot.create({ data: { name: "Test Depot", code: `D-${run}` } })).id;
      for (const [key, role] of [["staff", "STANDARD_USER"], ["spe", "SALES_PERSON_EXECUTIVE"]] as const) {
        users[key] = (
          await prisma.user.create({
            data: { firstName: "T", lastName: key, email: `${key}.${run}@example.test`, department: "T", role, status: "ACTIVE" },
          })
        ).id;
      }
      users.dealer = (
        await prisma.user.create({
          data: {
            firstName: "T",
            lastName: "dealer",
            email: `dealer.${run}@example.test`,
            department: "Dealer",
            role: "DEALER_ADMIN",
            accountType: "DEALER",
            status: "ACTIVE",
            dealerOrganizationId: organizationId,
          },
        })
      ).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.activityLog.deleteMany({ where: { actorId: { in: Object.values(users) } } });
      await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
      await prisma.depot.delete({ where: { id: depotId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    it("refuses a Staff Member and leaves the order unchanged", async () => {
      const order = await orderAwaitingVerification();

      const result = await core.applyInternalOrderAction(
        { id: users.staff, role: "STANDARD_USER" },
        form({ orderId: order.id, action: "confirm-payment" })
      );

      assert.equal(result, "refused");
      assert.equal((await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "PAYMENT_VERIFICATION");
      assert.equal(await prisma.activityLog.count({ where: { actorId: users.staff, action: "ORDER_ACTION_REFUSED" } }), 1);
    });

    it("hides Staff Members from a dealer's directory", async () => {
      const { listDirectory } = await import("@/lib/messaging/service");

      const ids = (await listDirectory(users.dealer)).map((u) => u.id);

      assert.equal(ids.includes(users.spe), true);
      assert.equal(ids.includes(users.staff), false);
    });

    it("lets a Sales Person Executive confirm the payment", async () => {
      const order = await orderAwaitingVerification();

      const result = await core.applyInternalOrderAction(
        { id: users.spe, role: "SALES_PERSON_EXECUTIVE" },
        form({ orderId: order.id, action: "confirm-payment" })
      );

      assert.equal(result, "done");
      assert.equal((await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "PAYMENT_CONFIRMED");
    });
  }
);
