import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "a dealer's payment emails every active Sales Person Executive",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let notify: typeof import("./payment-notify");
    const run = `pn${Date.now()}`;
    const userIds: string[] = [];
    let orgId = "";
    let stationId = "";
    let paymentId = "";

    const user = async (role: string, status: string, who: string, extra: Record<string, unknown> = {}) => {
      const u = await prisma.user.create({
        data: { firstName: who, lastName: "T", email: `${who}.${run}@example.test`, role: role as never, status: status as never, department: "Sales", ...extra },
      });
      userIds.push(u.id);
      return u;
    };

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      notify = await import("./payment-notify");
      orgId = (await prisma.dealerOrganization.create({ data: { name: `Notify Dealer ${run}`, code: `PN-${run}` } })).id;
      stationId = (await prisma.station.create({ data: { code: `pn-${run}`, name: "Notify Station", dealerOrganizationId: orgId } })).id;
      await user("SALES_PERSON_EXECUTIVE", "ACTIVE", "spe1");
      await user("SALES_PERSON_EXECUTIVE", "ACTIVE", "spe2");
      await user("SALES_PERSON_EXECUTIVE", "DISABLED", "speoff");
      await user("SUPER_ADMIN", "ACTIVE", "admin");
      const dealer = await user("DEALER_ADMIN", "ACTIVE", "dealer", { accountType: "DEALER", dealerOrganizationId: orgId });
      const order = await prisma.dealerOrder.create({
        data: { reference: `PN-${run}`, odooSyncKey: `pn:${run}`, status: "PAYMENT_VERIFICATION", amountDue: "2193200.00", dealerOrganizationId: orgId, stationId, createdById: dealer.id },
      });
      paymentId = (await prisma.paymentRecord.create({
        data: { orderId: order.id, amount: "2193200.00", status: "SUBMITTED", method: "MANUAL", bankAccountNumber: "1080281394514", bankReference: "FT26328DYBZ4", submittedById: dealer.id },
      })).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: orgId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.station.delete({ where: { id: stationId } });
      await prisma.dealerOrganization.delete({ where: { id: orgId } });
    });

    it("sends one email to each active SPE, and to nobody else", async () => {
      const sent: { to: string; subject: string; html: string }[] = [];
      await notify.notifySalesOfPayment(paymentId, { send: async (m) => void sent.push(m), configured: () => true });
      const ours = sent.filter((m) => m.to.endsWith(`${run}@example.test`)).map((m) => m.to.split(".")[0]).sort();
      assert.deepEqual(ours, ["spe1", "spe2"]);
      assert.match(sent[0].subject, /^Payment to confirm: KES 2,193,200\.00 from Notify Dealer/);
      assert.match(sent[0].html, new RegExp(`/intelligence/retail/orders/.+/payment`));
    });

    it("never throws when an email fails, so the dealer's payment still goes through", async () => {
      await assert.doesNotReject(() => notify.notifySalesOfPayment(paymentId, { send: async () => { throw new Error("provider down"); }, configured: () => true }));
    });

    it("sends nothing where email isn't set up", async () => {
      let calls = 0;
      await notify.notifySalesOfPayment(paymentId, { send: async () => void calls++, configured: () => false });
      assert.equal(calls, 0);
    });
  }
);
