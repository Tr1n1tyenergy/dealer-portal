import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

// A month nobody else's test data reaches, so the month figures hold only this test's orders.
const now = new Date("2031-03-17T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe(
  "staff analytics loader",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let loadAnalytics: typeof import("./load").loadAnalytics;
    const run = `an${Date.now()}`;
    let orgId = "";
    let dealerId = "";
    let before0: Awaited<ReturnType<typeof import("./load").loadAnalytics>>;
    const orderIds: string[] = [];

    async function makeOrder(status: string, createdAt: Date, lines: [string, number][], amountDue: string | null = null) {
      const o = await prisma.dealerOrder.create({
        data: {
          reference: `AN-${run}-${orderIds.length}`,
          odooSyncKey: `an:${run}:${orderIds.length}`,
          status: status as never,
          createdAt,
          amountDue,
          dealerOrganizationId: orgId,
          stationId: (await prisma.station.findFirstOrThrow({ where: { dealerOrganizationId: orgId } })).id,
          createdById: dealerId,
          lines: { create: lines.map(([product, quantityLitres]) => ({ product: product as never, quantityLitres })) },
        },
      });
      orderIds.push(o.id);
      return o;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      ({ loadAnalytics } = await import("./load"));
      before0 = await loadAnalytics(now);
      orgId = (await prisma.dealerOrganization.create({ data: { name: `Analytics Dealer ${run}`, code: `AN-${run}` } })).id;
      await prisma.station.create({ data: { name: `Analytics Station ${run}`, dealerOrganizationId: orgId } });
      dealerId = (
        await prisma.user.create({
          data: { firstName: "A", lastName: "Dealer", email: `an.${run}@example.test`, department: "Dealer", role: "DEALER_ADMIN", accountType: "DEALER", status: "ACTIVE", dealerOrganizationId: orgId },
        })
      ).id;
      const quoted = await makeOrder("AWAITING_PAYMENT", at("2031-03-10T08:00:00Z"), [["PMS", 10_000], ["AGO", 5_000]], "1000.00");
      const submitted = await makeOrder("SUBMITTED", at("2031-03-17T08:00:00Z"), [["PMS", 2_000]]);
      await makeOrder("CANCELLED", at("2031-03-12T08:00:00Z"), [["PMS", 99_000]], "5.00");
      await makeOrder("DELIVERED", at("2031-02-10T08:00:00Z"), [["AGO", 30_000]], "2000.00");
      await prisma.orderStatusHistory.createMany({
        data: [
          { orderId: quoted.id, toStatus: "SUBMITTED", createdAt: at("2031-03-10T08:00:00Z") },
          { orderId: quoted.id, toStatus: "PFI_ISSUED", createdAt: at("2031-03-10T10:00:00Z") },
          { orderId: quoted.id, toStatus: "AWAITING_PAYMENT", createdAt: at("2031-03-16T10:00:00Z") },
          { orderId: submitted.id, toStatus: "SUBMITTED", createdAt: at("2031-03-17T08:00:00Z") },
        ],
      });
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: orgId } });
      await prisma.user.deleteMany({ where: { id: dealerId } });
      await prisma.station.deleteMany({ where: { dealerOrganizationId: orgId } });
      await prisma.dealerOrganization.delete({ where: { id: orgId } });
      await prisma.$disconnect();
    });

    it("fills the month figures from this month's real orders", async () => {
      const a = await loadAnalytics(now);
      assert.deepEqual(a.figures.litres, { now: 17_000, prev: 30_000, change: -43.3 });
      assert.deepEqual(a.figures.value, { now: 1000, prev: 2000, change: -50 });
      assert.deepEqual(a.figures.orders, { now: 2, prev: 1, change: 100 });
      assert.equal(a.monthly.at(-1)!.pms, 12_000);
      assert.equal(a.monthly.at(-1)!.ago, 5_000);
      assert.equal(a.cycles[0].medianMs, 2 * 3_600_000);
      assert.deepEqual(a.top, [{ name: `Analytics Dealer ${run}`, litres: 17_000 }]);
    });

    it("counts the open orders per stage and lists the stuck one", async () => {
      const a = await loadAnalytics(now);
      const delta = (key: string) => a.stages.find((s) => s.key === key)!.count - before0.stages.find((s) => s.key === key)!.count;
      assert.equal(delta("quotation"), 1);
      assert.equal(delta("awaiting-payment"), 1);
      assert.equal(delta("transit"), 0);
      // SUBMITTED at 08:00, limit 2 h, now 12:00 → stuck 4 h.
      const mine = a.stuckAll.find((s) => s.reference === `AN-${run}-1`);
      assert.ok(mine, "submitted order is stuck");
      assert.equal(mine!.waitedMs, 4 * 3_600_000);
      assert.equal(a.stuckAll.some((s) => s.reference === `AN-${run}-0`), false, "awaiting payment for 26 h is under 48 h");
    });

    it("returns the latest events, newest first, worded for people", async () => {
      const a = await loadAnalytics(now);
      assert.ok(a.events.length <= 6);
      for (let i = 1; i < a.events.length; i++) assert.ok(a.events[i - 1].at >= a.events[i].at);
      assert.equal(a.events[0].text, `Analytics Dealer ${run} placed AN-${run}-1`);
    });

    it("shows empty figures for a month with no orders", async () => {
      const empty = await loadAnalytics(new Date("2032-07-15T12:00:00Z"));
      assert.deepEqual(empty.figures.orders, { now: 0, prev: 0, change: null });
      assert.deepEqual(empty.top, []);
      assert.ok(empty.monthly.every((m) => m.pms === 0 && m.ago === 0));
    });
  },
);
