import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { DealerOrderStatus, PrismaClient } from "@prisma/client";
import type { OdooClient } from "@/lib/integrations/odoo/types";

// Payments are tested against mock Odoo only; never a live Odoo, never real emails.
process.env.ODOO_MODE = "mock";
process.env.ODOO_API_KEY = "";
process.env.RESEND_API_KEY = "";

const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

const KCB = "1289725640";

describe(
  "PFI payments in parts",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let prisma: PrismaClient;
    let service: typeof import("./service");
    let MockOdooClient: typeof import("@/lib/integrations/odoo/client").MockOdooClient;
    const run = `p${Date.now()}`;
    let actorId = "";
    let staffId = "";
    let organizationId = "";
    let stationId = "";
    let sequence = 0;

    async function payableOrder(status: DealerOrderStatus = "AWAITING_PAYMENT", total = "1000.00") {
      sequence += 1;
      return prisma.dealerOrder.create({
        data: {
          reference: `PAY-${run}-${sequence}`,
          odooSyncKey: `pay:${run}:${sequence}`,
          status,
          amountDue: total,
          dealerOrganizationId: organizationId,
          stationId,
          createdById: actorId,
          proforma: { create: { number: `PFI-${run}-${sequence}`, amount: total } },
        },
      });
    }

    function manual(orderId: string, amount: string, bankReference = `FT${run}${sequence}${amount}`) {
      return service.submitPayment({
        orderId,
        actorId,
        dealerOrganizationId: organizationId,
        method: "MANUAL",
        amount,
        bankReference,
        bankAccountNumber: KCB,
      });
    }

    /** Mock Odoo with one method replaced. */
    function odooWith(overrides: Partial<OdooClient>): OdooClient {
      const base = new MockOdooClient();
      return Object.assign(Object.create(Object.getPrototypeOf(base)), base, overrides) as OdooClient;
    }

    before(async () => {
      ({ prisma } = await import("@/lib/prisma"));
      service = await import("./service");
      ({ MockOdooClient } = await import("@/lib/integrations/odoo/client"));
      organizationId = (await prisma.dealerOrganization.create({ data: { name: `Pay Dealer ${run}`, code: `PAY-${run}` } })).id;
      stationId = (await prisma.station.create({ data: { code: `pay-${run}`, name: "Pay Station", dealerOrganizationId: organizationId } })).id;
      const user = (role: "DEALER_ADMIN" | "SALES_PERSON_EXECUTIVE", who: string) =>
        prisma.user.create({
          data: { firstName: "Test", lastName: who, email: `${who}.${run}@example.test`, role, status: "ACTIVE", department: "Finance" },
        });
      actorId = (await user("DEALER_ADMIN", "dealer")).id;
      staffId = (await user("SALES_PERSON_EXECUTIVE", "staff")).id;
    });

    after(async () => {
      await prisma.dealerOrder.deleteMany({ where: { dealerOrganizationId: organizationId } });
      await prisma.activityLog.deleteMany({ where: { actorId: { in: [actorId, staffId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [actorId, staffId] } } });
      await prisma.station.delete({ where: { id: stationId } });
      await prisma.dealerOrganization.delete({ where: { id: organizationId } });
      await prisma.$disconnect();
    });

    describe("submitting", () => {
      it("takes a part payment and stays payable", async () => {
        const order = await payableOrder();
        const { paymentId } = await manual(order.id, "400");
        const saved = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id } });
        const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
        assert.equal(saved.status, "PAYMENT_VERIFICATION");
        assert.equal(payment.method, "MANUAL");
        assert.equal(payment.amount, "400.00");
        assert.equal(payment.bankAccountNumber, KCB);
        assert.equal(payment.odooState, "draft");
        assert.ok((payment.odooPaymentId ?? 0) > 900000);
      });

      it("takes a second payment while the first is waiting", async () => {
        const order = await payableOrder();
        await manual(order.id, "400");
        await manual(order.id, "300");
        const saved = await prisma.dealerOrder.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
        assert.equal(saved.status, "PAYMENT_VERIFICATION");
        assert.equal(saved.payments.filter((p) => p.status === "SUBMITTED" || p.status === "VERIFICATION").length, 2);
      });

      it("refuses a payment above the balance", async () => {
        const order = await payableOrder();
        await manual(order.id, "400");
        await assert.rejects(() => manual(order.id, "601"), /more than the balance of KES 600\.00/);
        await manual(order.id, "600");
      });

      it("refuses the second of two simultaneous payments that together pass the balance", async () => {
        const order = await payableOrder();
        await manual(order.id, "100", `FT0-${run}`);
        const results = await Promise.allSettled([manual(order.id, "500", `FTA-${run}`), manual(order.id, "500", `FTB-${run}`)]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(await prisma.paymentRecord.count({ where: { orderId: order.id } }), 2);
      });

      it("refuses a reused bank reference on the same account", async () => {
        const order = await payableOrder();
        await manual(order.id, "100", `FT1-${run}`);
        await assert.rejects(() => manual(order.id, "100", ` ft1-${run.toLowerCase()} `.replace("-", " -")), /already been used/);
      });

      it("takes an M-PESA payment by code with the amount from Odoo", async () => {
        const order = await payableOrder("AWAITING_PAYMENT", "5000.00");
        await prisma.paymentRecord.deleteMany({ where: { claimKey: "MPESA:TEST000001" } });
        const { paymentId } = await service.submitPayment({
          orderId: order.id,
          actorId,
          dealerOrganizationId: organizationId,
          method: "MPESA_CODE",
          mpesaCode: " test000001 ",
          amount: "1",
        });
        const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
        assert.equal(payment.amount, "1000.00");
        assert.equal(payment.method, "MPESA_CODE");
        assert.equal(payment.mpesaCode, "TEST000001");
        assert.equal(payment.odooState, "posted");
      });

      it("lookUpMpesaCode says when a code is already claimed", async () => {
        const result = await service.lookUpMpesaCode("test000001");
        assert.equal(result.ok, false);
        assert.match(result.ok ? "" : result.error, /already been used/);
      });

      it("refuses an unknown M-PESA code", async () => {
        const order = await payableOrder();
        await assert.rejects(
          () =>
            service.submitPayment({
              orderId: order.id,
              actorId,
              dealerOrganizationId: organizationId,
              method: "MPESA_CODE",
              mpesaCode: "NOPE000000",
            }),
          /can't find this M-PESA payment/
        );
        assert.equal(await prisma.paymentRecord.count({ where: { orderId: order.id } }), 0);
      });

      it("refuses the phone prompt until Daraja is connected", async () => {
        const order = await payableOrder();
        await assert.rejects(
          () => service.submitPayment({ orderId: order.id, actorId, dealerOrganizationId: organizationId, method: "MPESA_PROMPT", amount: "100" }),
          /not connected yet/
        );
      });

      it("keeps the payment and records the Odoo error when the draft fails", async () => {
        const order = await payableOrder();
        const broken = odooWith({
          createPaymentDraft: async () => {
            throw new Error("Odoo could not be reached.");
          },
        });
        const { paymentId } = await service.submitPayment(
          { orderId: order.id, actorId, dealerOrganizationId: organizationId, method: "MANUAL", amount: "100", bankReference: `FTX-${run}`, bankAccountNumber: KCB },
          broken
        );
        const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
        assert.equal(payment.odooPaymentId, null);
        assert.match(payment.odooError ?? "", /could not be reached/);

        await service.retryPaymentOdoo(paymentId, staffId);
        const retried = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
        assert.equal(retried.odooState, "draft");
        assert.equal(retried.odooError, null);
      });
    });
  }
);
