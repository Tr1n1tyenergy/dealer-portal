import { Prisma, type DealerOrderStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nairobiParts } from "@/lib/time/nairobi";
import { canActOnDepotOrder } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { resolveOdooPartnerId } from "@/lib/dealers/registry";
import { getOdooClient } from "@/lib/integrations/odoo/client";
import { putStoredFile } from "@/lib/files/stored-files";
import { odooPaymentsEnabled } from "@/lib/integrations/odoo/config";
import type { OdooClient } from "@/lib/integrations/odoo/types";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";
import { dealerUnitPriceForStation } from "@/lib/integrations/odoo/dealer-prices";
import { PFI_SIGNATORIES } from "@/lib/company/pfi-settings";
import { pfiTotals, PFI_VAT_RATE } from "@/lib/orders/pfi-totals";
import { assertTransition, InvalidOrderTransition, StaleOrderTransition } from "@/lib/orders/state-machine";
import {
  bankAccountByNumber,
  orderStatusAfterReview,
  parseMpesaCode,
  paymentClaimKey,
  paymentTotals,
  toCents,
} from "@/lib/orders/payments";
import { assertDealerCommercialOrdersAllowed } from "@/lib/security/launch-mode";
import {
  OrderInputError,
  type DepotAction,
  isDepotAction,
  nairobiToday,
  parseDeliveryDate,
  parseLitres,
  parseOrderLines,
  parsePaymentAmount,
} from "@/lib/orders/order-input";

const orderInclude = {
  lines: true,
  station: true,
  dealerOrganization: true,
  depot: true,
  proforma: true,
  payments: true,
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.DealerOrderInclude;


async function nextReference(tx: Prisma.TransactionClient) {
  // The year on the Nairobi calendar, so an order at 00:30 on 1 January gets the new year's number.
  const { year } = nairobiParts();
  const row = await tx.orderSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `DO-${year}-${String(row.lastNumber).padStart(6, "0")}`;
}

async function recordTransition(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    from: DealerOrderStatus;
    to: DealerOrderStatus;
    actorId?: string | null;
    note?: string;
    data?: Prisma.DealerOrderUncheckedUpdateManyInput;
  }
) {
  assertTransition(params.from, params.to);
  // Only move the order if it is still in the status the caller read. A concurrent request
  // that already moved it makes this match no rows, so the transition cannot apply twice.
  const { count } = await tx.dealerOrder.updateMany({
    where: { id: params.orderId, status: params.from },
    data: { status: params.to, ...params.data },
  });
  if (count === 0) throw new StaleOrderTransition(params.from, params.to);
  const order = await tx.dealerOrder.findUniqueOrThrow({
    where: { id: params.orderId },
    include: orderInclude,
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId: params.orderId,
      fromStatus: params.from,
      toStatus: params.to,
      actorId: params.actorId ?? null,
      note: params.note,
    },
  });
  return order;
}

async function findSubmittedOrder(submissionKey: string | null | undefined, dealerOrganizationId: string) {
  if (!submissionKey) return null;
  const order = await prisma.dealerOrder.findUnique({ where: { submissionKey }, include: orderInclude });
  if (order && order.dealerOrganizationId !== dealerOrganizationId) {
    throw new Error("This order submission belongs to another dealer.");
  }
  return order;
}

export async function submitDealerOrder(params: {
  actorId: string;
  dealerOrganizationId: string;
  stationId: string;
  requestedDeliveryDate?: string | null;
  dealerReference?: string | null;
  notes?: string | null;
  lines: { product: "PMS" | "AGO"; quantityLitres: number }[];
  submissionKey?: string | null;
}) {
  assertDealerCommercialOrdersAllowed();
  // Same rules as the order form, re-checked here for any other caller.
  for (const line of params.lines) {
    const litres = parseLitres(String(line.quantityLitres));
    if (!litres.ok) throw new OrderInputError(litres.message);
  }
  const quantity = (product: "PMS" | "AGO") =>
    params.lines.filter((l) => l.product === product).reduce((sum, l) => sum + l.quantityLitres, 0);
  const lines = parseOrderLines({ pms: String(quantity("PMS")), ago: String(quantity("AGO")) });
  if (!lines.ok) throw new OrderInputError(lines.message);
  const deliveryDate = parseDeliveryDate(params.requestedDeliveryDate);
  if (!deliveryDate.ok) throw new OrderInputError(deliveryDate.message);

  const station = await prisma.station.findFirst({
    where: { id: params.stationId, dealerOrganizationId: params.dealerOrganizationId },
    include: { dealerOrganization: true },
  });
  if (!station) throw new OrderInputError("That station is not available to this dealer.");

  // A repeated submit of the same Place Order form returns the order it already created.
  const alreadySubmitted = await findSubmittedOrder(params.submissionKey, params.dealerOrganizationId);
  if (alreadySubmitted) return alreadySubmitted;

  let created: string;
  try {
    created = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const order = await tx.dealerOrder.create({
        data: {
          reference,
          dealerOrganizationId: params.dealerOrganizationId,
          stationId: station.id,
          createdById: params.actorId,
          status: "SUBMITTED",
          requestedDeliveryDate: deliveryDate.value
            ? new Date(deliveryDate.value)
            : null,
          dealerReference: params.dealerReference || null,
          notes: params.notes || null,
          odooSyncKey: `quotation:${reference}`,
          submissionKey: params.submissionKey || null,
          lines: { create: lines.value },
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
          actorId: params.actorId,
          note: "Dealer submitted fuel order",
        },
      });
      return order.id;
    });
  } catch (error) {
    // Two identical submits raced past the check above; the unique key let only one through.
    const winner = await findSubmittedOrder(params.submissionKey, params.dealerOrganizationId);
    if (winner && (error as { code?: string }).code === "P2002") return winner;
    throw error;
  }

  await logActivity({
    actorId: params.actorId,
    action: "DEALER_ORDER_SUBMITTED",
    entity: "DealerOrder",
    entityId: created,
  });

  return syncQuotation(created, params.actorId);
}

export async function syncQuotation(orderId: string, actorId?: string | null) {
  const current = await prisma.dealerOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, station: true, dealerOrganization: true },
  });
  if (!current) throw new Error("Order not found.");
  if (current.odooQuotationId) return prisma.dealerOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });

  let status = current.status;
  if (status === "SUBMITTED" || status === "ODOO_SYNC_FAILED") {
    const moved = await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: status,
        to: "ODOO_SYNC_PENDING",
        actorId,
        note: "Sending order to Odoo",
      })
    );
    status = moved.status;
  }
  if (status !== "ODOO_SYNC_PENDING" && status !== "QUOTATION_CREATING") {
    throw new Error("This order is not ready to sync.");
  }

  try {
    const client = getOdooClient();
    const stationCode = current.station.code ?? null;
    const fulfillment = stationCode ? fulfillmentForStation(stationCode) : null;
    const fuelLines = await Promise.all(
      current.lines
        .filter((line) => line.product === "PMS" || line.product === "AGO")
        .map(async (line) => {
          const product = line.product as "PMS" | "AGO";
          return {
            id: line.id,
            product,
            quantityLitres: line.quantityLitres,
            unitPrice: stationCode ? await dealerUnitPriceForStation(stationCode, product) : null,
          };
        })
    );
    const quotation = await client.createQuotation({
      idempotencyKey: current.odooSyncKey,
      dealerCode: current.dealerOrganization.code,
      dealerName: current.dealerOrganization.name,
      odooPartnerExternalId:
        current.station.odooPartnerExternalId ??
        current.dealerOrganization.odooPartnerExternalId ??
        null,
      odooPartnerId: resolveOdooPartnerId(
        current.station.odooPartnerId,
        current.dealerOrganization.odooPartnerId
      ),
      stationName: current.station.name,
      stationCode,
      odooStationId: fulfillment?.odooStationId ?? null,
      requestedDeliveryDate: current.requestedDeliveryDate?.toISOString() ?? null,
      dealerReference: current.dealerReference,
      notes: current.notes,
      lines: fuelLines.map(({ product, quantityLitres, unitPrice }) => ({ product, quantityLitres, unitPrice })),
    });

    const saved = await prisma.$transaction(async (tx) => {
      // Freeze the price sent to Odoo on each line; the PFI is worked out from it.
      for (const line of fuelLines) {
        if (line.unitPrice == null) continue;
        await tx.dealerOrderLine.update({ where: { id: line.id }, data: { unitPriceExVat: String(line.unitPrice) } });
      }
      return recordTransition(tx, {
        orderId,
        from: "ODOO_SYNC_PENDING",
        to: "QUOTATION_READY",
        actorId,
        note: `Odoo quotation ${quotation.number}`,
        data: {
          odooQuotationId: quotation.id,
          odooQuotationNumber: quotation.number,
          quotedAt: new Date(),
          amountDue: quotation.amountTotal,
          currency: quotation.currency,
          odooSyncError: null,
        },
      });
    });
    await logActivity({
      actorId,
      action: "ODOO_QUOTATION_CREATED",
      entity: "DealerOrder",
      entityId: orderId,
      meta: { quotationNumber: quotation.number, mode: client.mode },
    });
    // The PFI follows straight away. If it can't be issued the quotation stands and staff can retry.
    try {
      return await generatePfi(orderId, actorId ?? null);
    } catch (error) {
      console.warn("Automatic PFI failed", orderId, error);
      return saved;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Odoo sync failed";
    await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: "ODOO_SYNC_PENDING",
        to: "ODOO_SYNC_FAILED",
        actorId,
        note: message,
        data: { odooSyncError: message },
      })
    );
    await logActivity({
      actorId,
      action: "ODOO_QUOTATION_FAILED",
      entity: "DealerOrder",
      entityId: orderId,
      meta: { message },
    });
    return prisma.dealerOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  }
}

export const PFI_NO_PRICE_NOTE =
  "PFI not issued: this station has no dealer price in Stations & Pricing yet.";

/**
 * Issue the PFI from the order's frozen line prices: 8% VAT on top, numbered with the SO
 * (quotation) number, fixed signatories. Odoo is not contacted.
 */
export async function generatePfi(orderId: string, actorId: string | null) {
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId }, include: { lines: true, station: true } });
  if (!order?.odooQuotationId) throw new Error("A quotation is required before a PFI.");

  const existing = await prisma.proFormaInvoice.findUnique({ where: { orderId } });
  if (existing) {
    // The PFI was saved but the order never reached AWAITING_PAYMENT: finish that step.
    if (order.status !== "PFI_ISSUED") return order;
    return prisma.$transaction((tx) =>
      recordTransition(tx, { orderId, from: "PFI_ISSUED", to: "AWAITING_PAYMENT", actorId, note: "Waiting for dealer payment" })
    );
  }

  // A previous attempt may have left the order in PFI_PENDING; retry straight from there.
  if (order.status !== "PFI_PENDING") {
    await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: order.status,
        to: "PFI_PENDING",
        actorId,
        note: "Issuing the PFI",
      })
    );
  }

  const stationCode = order.station.code ?? null;
  const fuelLines = await Promise.all(
    order.lines
      .filter((line) => line.product === "PMS" || line.product === "AGO")
      .map(async (line) => {
        const product = line.product as "PMS" | "AGO";
        const today = stationCode ? await dealerUnitPriceForStation(stationCode, product) : null;
        return { line, product, price: line.unitPriceExVat ?? (today == null ? null : String(today)) };
      })
  );

  if (fuelLines.length === 0 || fuelLines.some((l) => l.price == null)) {
    const returned = await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: "PFI_PENDING",
        to: "QUOTATION_READY",
        actorId,
        note: PFI_NO_PRICE_NOTE,
        data: { odooSyncError: PFI_NO_PRICE_NOTE },
      })
    );
    await logActivity({
      actorId,
      action: "PFI_FAILED",
      entity: "DealerOrder",
      entityId: orderId,
      meta: { message: PFI_NO_PRICE_NOTE },
    });
    return returned;
  }

  const totals = pfiTotals(
    fuelLines.map((l) => ({ product: l.product, quantityLitres: l.line.quantityLitres, unitPriceExVat: l.price as string })),
    PFI_VAT_RATE
  );
  const number = order.odooQuotationNumber ?? order.reference;

  let saved;
  try {
    saved = await prisma.$transaction(async (tx) => {
      // Older lines without a stored price are frozen at today's price.
      for (const l of fuelLines) {
        if (l.line.unitPriceExVat == null) {
          await tx.dealerOrderLine.update({ where: { id: l.line.id }, data: { unitPriceExVat: l.price } });
        }
      }
      await tx.proFormaInvoice.create({
        data: {
          orderId,
          number,
          amount: totals.total,
          currency: order.currency,
          subtotal: totals.subtotal,
          vatAmount: totals.vat,
          vatRate: totals.vatRate,
          preparedByName: PFI_SIGNATORIES.preparedBy,
          approvedByName: PFI_SIGNATORIES.approvedBy,
        },
      });
      return recordTransition(tx, {
        orderId,
        from: "PFI_PENDING",
        to: "PFI_ISSUED",
        actorId,
        note: `PFI ${number}`,
        data: { amountDue: totals.total, odooSyncError: null },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      // Another request issued this order's PFI at the same moment.
      if (await prisma.proFormaInvoice.findUnique({ where: { orderId } })) {
        return prisma.dealerOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
      }
      // Otherwise the number belongs to another order's PFI: say so instead of leaving it at PFI_PENDING.
      const note = `PFI not issued: number ${number} is already used by another order.`;
      return prisma.$transaction((tx) =>
        recordTransition(tx, { orderId, from: "PFI_PENDING", to: "QUOTATION_READY", actorId, note, data: { odooSyncError: note } })
      );
    }
    throw error;
  }
  await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId,
      from: "PFI_ISSUED",
      to: "AWAITING_PAYMENT",
      actorId,
      note: "Waiting for dealer payment",
    })
  );
  await logActivity({
    actorId,
    action: "PFI_GENERATED",
    entity: "DealerOrder",
    entityId: orderId,
    meta: { number, total: totals.total },
  });
  return saved;
}

/** Order statuses that take another payment (a part-paid order is back in AWAITING_PAYMENT). */
const PAYABLE: DealerOrderStatus[] = ["AWAITING_PAYMENT", "PAYMENT_EXCEPTION", "PAYMENT_VERIFICATION"];

const MPESA_NOT_FOUND =
  "We can't find this M-PESA payment yet. It can take a few minutes to reach us. Check the code or try again shortly.";
const REFERENCE_USED = "This reference has already been used.";

const kes = (cents: number) => (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Checks an M-PESA code against Odoo (read only) before the dealer submits it. */
export async function lookUpMpesaCode(
  code: string,
  odoo: OdooClient = getOdooClient()
): Promise<{ ok: true; amount: string; date: string } | { ok: false; error: string }> {
  const parsed = parseMpesaCode(code);
  if (!parsed.ok) return { ok: false, error: parsed.message };
  const claimed = await prisma.paymentRecord.findUnique({ where: { claimKey: `MPESA:${parsed.value}` } });
  if (claimed) return { ok: false, error: REFERENCE_USED };
  const found = await odoo.findMpesaPayment(parsed.value);
  return found ? { ok: true, amount: found.amount, date: found.date } : { ok: false, error: MPESA_NOT_FOUND };
}

export async function submitPayment(
  params: {
    orderId: string;
    actorId: string;
    dealerOrganizationId: string;
    method: PaymentMethod;
    amount?: string;
    bankReference?: string;
    bankAccountNumber?: string;
    mpesaCode?: string;
    note?: string;
  },
  odoo: OdooClient = getOdooClient()
): Promise<{ paymentId: string }> {
  let amount: string;
  let mpesa: { code: string; odooPaymentId: number; odooState: string; payer: string } | null = null;
  let bankReference: string | undefined;
  let bankAccountNumber: string | undefined;

  if (params.method === "MPESA_PROMPT") throw new OrderInputError("M-PESA prompts are not connected yet.");
  if (params.method === "MPESA_CODE") {
    const code = parseMpesaCode(params.mpesaCode);
    if (!code.ok) throw new OrderInputError(code.message);
    let found: Awaited<ReturnType<OdooClient["findMpesaPayment"]>>;
    try {
      found = await odoo.findMpesaPayment(code.value);
    } catch {
      throw new OrderInputError("We couldn't check this M-PESA code right now. Try again shortly.");
    }
    if (!found) throw new OrderInputError(MPESA_NOT_FOUND);
    amount = found.amount;
    mpesa = { code: code.value, odooPaymentId: found.id, odooState: found.state, payer: found.ref.slice(0, 200) };
  } else {
    bankReference = params.bankReference?.trim();
    if (!bankReference) throw new OrderInputError("Enter the bank reference from your bank.");
    const account = bankAccountByNumber(params.bankAccountNumber);
    if (!account) throw new OrderInputError("Choose the Trinity account you paid to.");
    bankAccountNumber = account.accountNumber;
    const parsed = parsePaymentAmount(params.amount);
    if (!parsed.ok) throw new OrderInputError(parsed.message);
    amount = parsed.value;
  }

  const order = await prisma.dealerOrder.findFirst({
    where: { id: params.orderId, dealerOrganizationId: params.dealerOrganizationId },
  });
  if (!order) throw new OrderInputError("Order not found.");

  let paymentId: string;
  try {
    // One transaction, with the order row locked: two payments sent together can't both fit the balance,
    // and if the order cannot take a payment, no payment record is left behind.
    paymentId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DealerOrder" WHERE id = ${order.id} FOR UPDATE`;
      const current = await tx.dealerOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { proforma: true, payments: true },
      });
      if (!PAYABLE.includes(current.status)) throw new InvalidOrderTransition(current.status, "PAYMENT_SUBMITTED");
      const totals = paymentTotals(current.proforma?.amount ?? current.amountDue, current.payments);
      if (totals.balanceCents == null) throw new OrderInputError("This order has no PFI to pay yet.");
      if ((toCents(amount) ?? 0) > totals.balanceCents) {
        throw new OrderInputError(`This is more than the balance of KES ${kes(totals.balanceCents)}.`);
      }

      const moving = current.status !== "PAYMENT_VERIFICATION";
      if (moving) {
        await recordTransition(tx, {
          orderId: order.id,
          from: current.status,
          to: "PAYMENT_SUBMITTED",
          actorId: params.actorId,
          note: "Dealer submitted payment details",
        });
      }
      const payment = await tx.paymentRecord.create({
        data: {
          orderId: order.id,
          amount,
          method: params.method,
          bankReference,
          bankAccountNumber,
          mpesaCode: mpesa?.code,
          mpesaPayer: mpesa?.payer,
          claimKey: paymentClaimKey({ method: params.method, mpesaCode: mpesa?.code, bankAccountNumber, bankReference }),
          odooPaymentId: mpesa?.odooPaymentId,
          odooState: mpesa?.odooState,
          note: params.note,
          submittedById: params.actorId,
          status: "SUBMITTED",
        },
      });
      if (moving) {
        await recordTransition(tx, {
          orderId: order.id,
          from: "PAYMENT_SUBMITTED",
          to: "PAYMENT_VERIFICATION",
          actorId: params.actorId,
          note: "Queued for finance verification",
        });
      }
      return payment.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OrderInputError(REFERENCE_USED);
    }
    throw error;
  }

  await logActivity({
    actorId: params.actorId,
    action: "PAYMENT_SUBMITTED",
    entity: "DealerOrder",
    entityId: order.id,
    meta: { paymentId, method: params.method },
  });
  if (params.method === "MANUAL") await pushPaymentToOdoo(paymentId, odoo);
  return { paymentId };
}

/** Creates the Odoo account.payment draft for a manual payment. Never throws: failures land in odooError. */
export async function pushPaymentToOdoo(
  paymentId: string,
  odoo: OdooClient = getOdooClient(),
  currencyId?: number
): Promise<void> {
  if (!odooPaymentsEnabled()) return;
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { order: { include: { station: true, dealerOrganization: true } } },
  });
  // Only a payment still waiting for staff: a reviewed one must never get a (stray) Odoo draft.
  if (
    !payment ||
    payment.method !== "MANUAL" ||
    payment.odooPaymentId != null ||
    (payment.status !== "SUBMITTED" && payment.status !== "VERIFICATION")
  ) {
    return;
  }
  const account = bankAccountByNumber(payment.bankAccountNumber);
  try {
    if (!account || !payment.bankReference) throw new Error("This payment has no Trinity account or bank reference.");
    const { order } = payment;
    const draft = await odoo.createPaymentDraft({
      idempotencyKey: `payment:${payment.id}`,
      dealerCode: order.dealerOrganization.code,
      dealerName: order.dealerOrganization.name,
      odooPartnerExternalId: order.station.odooPartnerExternalId ?? order.dealerOrganization.odooPartnerExternalId ?? null,
      odooPartnerId: resolveOdooPartnerId(order.station.odooPartnerId, order.dealerOrganization.odooPartnerId),
      amount: payment.amount,
      date: nairobiToday(),
      reference: payment.bankReference,
      journalId: account.odoo.journalId,
      paymentMethodLineId: account.odoo.paymentMethodLineId,
      partnerBankId: account.odoo.partnerBankId,
      currencyId,
    });
    // Only the first writer records its draft (a retry racing the dealer's own push).
    await prisma.paymentRecord.updateMany({
      where: { id: payment.id, odooPaymentId: null },
      data: { odooPaymentId: draft.id, odooState: draft.state, odooError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.paymentRecord.update({ where: { id: payment.id }, data: { odooError: message.slice(0, 300) } });
  }
}

/** Puts the staff member's reviewed amount, reference, journal and bank account onto an existing draft. */
async function writeReviewedDraft(paymentId: string, odoo: OdooClient, currencyId?: number) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    include: { order: { include: { station: true, dealerOrganization: true } } },
  });
  const account = bankAccountByNumber(payment?.bankAccountNumber);
  if (!payment?.odooPaymentId || !account || !payment.bankReference) {
    throw new Error("This payment has no Odoo draft, Trinity account, or bank reference.");
  }
  const { order } = payment;
  await odoo.writePaymentDraft(payment.odooPaymentId, {
    idempotencyKey: `payment:${payment.id}`,
    dealerCode: order.dealerOrganization.code,
    dealerName: order.dealerOrganization.name,
    odooPartnerExternalId: order.station.odooPartnerExternalId ?? order.dealerOrganization.odooPartnerExternalId ?? null,
    odooPartnerId: resolveOdooPartnerId(order.station.odooPartnerId, order.dealerOrganization.odooPartnerId),
    amount: payment.amount,
    date: nairobiToday(),
    reference: payment.bankReference,
    journalId: account.odoo.journalId,
    paymentMethodLineId: account.odoo.paymentMethodLineId,
    partnerBankId: account.odoo.partnerBankId,
    currencyId,
  });
}

export async function retryPaymentOdoo(paymentId: string, actorId: string, odoo: OdooClient = getOdooClient()) {
  await pushPaymentToOdoo(paymentId, odoo);
  await logActivity({ actorId, action: "PAYMENT_ODOO_RETRY", entity: "PaymentRecord", entityId: paymentId });
}

/**
 * Staff confirm or flag one payment. With Odoo payments on, Confirm posts the manual payment's draft
 * (or re-checks an M-PESA payment Odoo already posted) and the portal only confirms what Odoo posted;
 * Flag cancels the draft. Older payments (no account recorded) and the switch off: portal-only.
 */
export async function reviewPayment(
  paymentId: string,
  actorId: string,
  accept: boolean,
  note?: string,
  odoo: OdooClient = getOdooClient(),
  options?: { forceReceipt?: boolean; currencyId?: number }
): Promise<"done" | "stale" | "odoo-failed"> {
  // Claim the payment first, so two staff pressing Confirm together can't post it twice. A claim older
  // than two minutes was abandoned (the server died mid-way) and may be taken again.
  const now = new Date();
  const claim = await prisma.paymentRecord.updateMany({
    where: {
      id: paymentId,
      status: { in: ["SUBMITTED", "VERIFICATION"] },
      OR: [{ reviewedAt: null }, { reviewedAt: { lt: new Date(now.getTime() - CLAIM_EXPIRES_MS) } }],
    },
    data: { reviewedAt: now, reviewedById: actorId },
  });
  if (claim.count === 0) return "stale";
  const release = (data: Prisma.PaymentRecordUpdateInput = {}) =>
    prisma.paymentRecord.update({ where: { id: paymentId }, data: { reviewedAt: null, reviewedById: null, ...data } });
  try {
    return await reviewClaimedPayment(paymentId, actorId, accept, note, odoo, release, options);
  } catch (error) {
    await release().catch(() => undefined);
    throw error;
  }
}

const CLAIM_EXPIRES_MS = 2 * 60_000;

async function reviewClaimedPayment(
  paymentId: string,
  actorId: string,
  accept: boolean,
  note: string | undefined,
  odoo: OdooClient,
  release: (data?: Prisma.PaymentRecordUpdateInput) => Promise<unknown>,
  options?: { forceReceipt?: boolean; currencyId?: number }
): Promise<"done" | "odoo-failed"> {
  const payment = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
  // Manual payments use Odoo only if they went there (or tried to) while the switch was on: one sent
  // while it was off may already be typed into Odoo by Accounts, so a new draft would count it twice.
  const sentToOdoo = payment.odooPaymentId != null || payment.odooError != null;
  // forceReceipt is the payment-review page: staff have just checked the mapping and asked to post it,
  // including a payment that arrived while automatic receipting was off.
  const useOdoo =
    odooPaymentsEnabled() &&
    (payment.method === "MPESA_CODE" ||
      (payment.method === "MANUAL" && payment.bankAccountNumber != null && (sentToOdoo || options?.forceReceipt === true)));

  if (accept && useOdoo) {
    try {
      if (payment.method === "MANUAL") {
        let odooId = payment.odooPaymentId;
        if (odooId == null) {
          await pushPaymentToOdoo(paymentId, odoo, options?.currencyId);
          const pushed = await prisma.paymentRecord.findUniqueOrThrow({ where: { id: paymentId } });
          if (pushed.odooPaymentId == null) throw new Error(pushed.odooError ?? "The Odoo draft could not be created.");
          odooId = pushed.odooPaymentId;
        } else {
          await writeReviewedDraft(paymentId, odoo, options?.currencyId);
        }
        const posted = await odoo.postPayment(odooId);
        await prisma.paymentRecord.update({ where: { id: paymentId }, data: { odooState: posted.state } });
        if (posted.state !== "posted") throw new Error(`Odoo left the payment in "${posted.state}", not posted.`);
      } else {
        const found = await odoo.findMpesaPayment(payment.mpesaCode ?? "");
        if (!found || found.state !== "posted" || toCents(found.amount) !== toCents(payment.amount)) {
          throw new Error("This M-PESA payment no longer matches Odoo.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await release({ odooError: message.slice(0, 300) });
      return "odoo-failed";
    }
  }

  const amountText = `KES ${kes(toCents(payment.amount) ?? 0)}`;
  const reason = note?.trim() || null;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DealerOrder" WHERE id = ${payment.orderId} FOR UPDATE`;
    await tx.paymentRecord.update({
      where: { id: paymentId },
      data: accept
        ? { status: "CONFIRMED", reviewNote: reason, odooError: null }
        : { status: "REJECTED", reviewNote: reason, claimKey: null },
    });
    const order = await tx.dealerOrder.findUniqueOrThrow({
      where: { id: payment.orderId },
      include: { proforma: true, payments: true },
    });
    const totals = paymentTotals(order.proforma?.amount ?? order.amountDue, order.payments);
    // An order with no PFI total (older data): one confirmation pays it, as before.
    const next =
      totals.totalCents == null && accept ? "PAYMENT_CONFIRMED" : orderStatusAfterReview(totals);
    if (next !== order.status) {
      await recordTransition(tx, {
        orderId: order.id,
        from: order.status,
        to: next,
        actorId,
        note: [accept ? `Payment confirmed — ${amountText}` : `Payment needs review — ${amountText}`, reason]
          .filter(Boolean)
          .join(" — "),
      });
    }
  });

  if (!accept && useOdoo && payment.method === "MANUAL" && payment.odooPaymentId != null) {
    try {
      const cancelled = await odoo.cancelPayment(payment.odooPaymentId);
      await prisma.paymentRecord.update({
        where: { id: paymentId },
        data: {
          odooState: cancelled.state,
          odooError:
            cancelled.state === "cancel"
              ? null
              : `Posted in Odoo, not cancelled: check with Accounts (Odoo state "${cancelled.state}").`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.paymentRecord.update({
        where: { id: paymentId },
        data: { odooError: `Cancel the draft in Odoo by hand: ${message}`.slice(0, 300) },
      });
    }
  }

  const recorded = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    select: {
      amount: true,
      method: true,
      bankReference: true,
      bankAccountNumber: true,
      odooPaymentId: true,
      odooState: true,
      order: { select: { reference: true, proforma: { select: { number: true } }, dealerOrganization: { select: { name: true } } } },
    },
  });
  const journal = bankAccountByNumber(recorded?.bankAccountNumber);
  if (accept && odoo.mode === "live") {
    const paid = await prisma.dealerOrder.findUnique({
      where: { id: payment.orderId },
      include: { proforma: true, payments: true },
    });
    const paidTotals = paid ? paymentTotals(paid.proforma?.amount ?? paid.amountDue, paid.payments) : null;
    if (paid?.status === "PAYMENT_CONFIRMED" && paidTotals?.balanceCents === 0) {
      try {
        await continuePaidOrder(paid.id, actorId, odoo);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.dealerOrder.update({
          where: { id: paid.id },
          data: { fulfillmentError: message.slice(0, 500) },
        });
      }
    }
  }

  await logActivity({
    actorId,
    action: accept ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED",
    entity: "DealerOrder",
    entityId: payment.orderId,
    meta: {
      paymentId,
      dealer: recorded?.order.dealerOrganization.name ?? null,
      order: recorded?.order.reference ?? null,
      pfi: recorded?.order.proforma?.number ?? null,
      amount: recorded?.amount ?? payment.amount,
      currency: "KES",
      method: recorded?.method ?? payment.method,
      bankReference: recorded?.bankReference ?? payment.bankReference,
      journalId: journal?.odoo.journalId ?? null,
      odooPaymentId: recorded?.odooPaymentId ?? null,
      odooState: recorded?.odooState ?? null,
      outcome: accept ? (useOdoo ? "receipted" : "portal-only") : "flagged",
    },
  });
  return "done";
}

const BOOKING_PATH = [
  "PAYMENT_CONFIRMED",
  "ORDER_BOOKED",
  "WAITING_KRA_INVOICE",
  "KRA_INVOICE_RECEIVED",
  "DEPOT_DOCS_RECEIVED",
] as const;

const BOOKING_NOTE: Record<(typeof BOOKING_PATH)[number], string> = {
  PAYMENT_CONFIRMED: "Payment confirmed",
  ORDER_BOOKED: "Order booked and approved in Odoo",
  WAITING_KRA_INVOICE: "Invoice sent to KRA",
  KRA_INVOICE_RECEIVED: "KRA invoice received",
  DEPOT_DOCS_RECEIVED: "Loading order, gate pass and sales order held for the depot",
};

async function saveOrderDocument(orderId: string, kind: string, fileName: string, bytes: Buffer) {
  const existing = await prisma.orderDocument.findFirst({ where: { orderId, kind } });
  if (existing) return;
  const key = `order-doc/${orderId}/${kind}`;
  await putStoredFile(key, bytes);
  await prisma.orderDocument.create({ data: { orderId, kind, fileName, storagePath: key } });
}

/**
 * After a payment clears the balance: book and approve the Odoo order, post the invoice to KRA,
 * and keep the branded invoice plus the loading documents on the order.
 * A second call continues from whatever Odoo and the portal already finished.
 */
export async function continuePaidOrder(orderId: string, actorId: string, odoo: OdooClient = getOdooClient()) {
  if (odoo.mode !== "live") return;
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  if (!order || !BOOKING_PATH.includes(order.status as (typeof BOOKING_PATH)[number])) return;
  const saleOrderId = Number(order.odooQuotationId);
  if (!Number.isFinite(saleOrderId)) {
    await prisma.dealerOrder.update({
      where: { id: orderId },
      data: { fulfillmentError: "This order has no Odoo quotation to book." },
    });
    return;
  }

  let result;
  try {
    result = await odoo.fulfillPaidOrder(saleOrderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.dealerOrder.update({ where: { id: orderId }, data: { fulfillmentError: message.slice(0, 500) } });
    return;
  }

  const savedKinds = new Set<string>();
  const saveProblems: string[] = [];
  for (const document of result.documents) {
    try {
      await saveOrderDocument(orderId, document.kind, document.fileName.replace(/[^\w.\-]+/g, "_"), document.bytes);
      savedKinds.add(document.kind);
    } catch (error) {
      saveProblems.push(error instanceof Error ? error.message : String(error));
    }
  }
  const documentError = [result.documentError, ...saveProblems].filter(Boolean).join(" ") || null;
  const hasEtims = Boolean(result.etimsInvoiceNumber) && savedKinds.has("etims-invoice");
  const hasDepotDocs = savedKinds.has("loading-order") && savedKinds.has("gate-pass") && savedKinds.has("sale-order");
  const target = hasEtims ? (hasDepotDocs ? "DEPOT_DOCS_RECEIVED" : "KRA_INVOICE_RECEIVED") : "WAITING_KRA_INVOICE";

  await prisma.dealerOrder.update({
    where: { id: orderId },
    data: {
      odooInvoiceId: result.invoiceId,
      odooInvoiceNumber: result.invoiceNumber,
      odooPickingId: result.pickingId,
      etimsInvoiceNumber: result.etimsInvoiceNumber,
      etimsReceiptNumber: result.etimsReceiptNumber,
      fulfillmentError: target === "DEPOT_DOCS_RECEIVED" ? null : documentError ?? (hasEtims ? null : "KRA has not returned the invoice yet."),
    },
  });

  let current = (await prisma.dealerOrder.findUniqueOrThrow({ where: { id: orderId } })).status;
  const start = BOOKING_PATH.indexOf(current as (typeof BOOKING_PATH)[number]);
  const end = BOOKING_PATH.indexOf(target);
  if (start < 0 || end < 0) return;
  for (let index = start; index < end; index += 1) {
    const next = BOOKING_PATH[index + 1];
    if (!next) break;
    await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: current,
        to: next,
        actorId,
        note: BOOKING_NOTE[next],
      })
    );
    current = next;
  }
}

export async function releaseToDepot(orderId: string, actorId: string, depotId: string) {
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");
  const depot = await prisma.depot.findUnique({ where: { id: depotId } });
  if (!depot) throw new Error("Depot not found.");
  const saved = await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId,
      from: order.status,
      to: "RELEASED_TO_DEPOT",
      actorId,
      note: `Released to ${depot.name}`,
      data: { depotId: depot.id },
    })
  );
  await logActivity({
    actorId,
    action: "ORDER_RELEASED_TO_DEPOT",
    entity: "DealerOrder",
    entityId: orderId,
    meta: { depotId },
  });
  return saved;
}

export async function applyDepotAction(
  orderId: string,
  actor: { id: string; role: string; depotId: string | null },
  action: DepotAction,
  fields: {
    truckRegistration?: string;
    driverName?: string;
    transporter?: string;
    loadedPmsLitres?: number;
    loadedAgoLitres?: number;
    loadingReference?: string;
    sealNumbers?: string;
    deliveryNoteRef?: string;
  }
) {
  if (!isDepotAction(action)) throw new OrderInputError("Unknown depot action.");
  const actorId = actor.id;
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  // Another depot's order is reported as missing, so a manager cannot probe which orders exist.
  if (!order || !canActOnDepotOrder(actor, order.depotId)) throw new OrderInputError("Order not found.");
  for (const loaded of [fields.loadedPmsLitres, fields.loadedAgoLitres]) {
    if (loaded === undefined) continue;
    const litres = parseLitres(String(loaded));
    if (!litres.ok) throw new OrderInputError(litres.message);
  }

  const map = {
    accept: { to: "LOADING" as const, action: "LOADING_STARTED", note: "Loading started" },
    "receive-docs": { to: "LOADING" as const, action: "LOADING_STARTED", note: "Loading started" },
    "release-station": { to: "IN_TRANSIT" as const, action: "ORDER_RELEASED_TO_STATION", note: "Released to the station" },
    complete: { to: "LOADED" as const, action: "LOADING_COMPLETED", note: "Loading complete" },
    dispatch: { to: "DISPATCHED" as const, action: "ORDER_DISPATCHED", note: "Truck dispatched" },
    deliver: { to: "DELIVERED" as const, action: "ORDER_DELIVERED", note: "Delivery confirmed" },
    close: { to: "CLOSED" as const, action: "ORDER_CLOSED", note: "Order closed" },
  }[action];

  const data: Prisma.DealerOrderUncheckedUpdateManyInput = {};
  if (fields.truckRegistration) data.truckRegistration = fields.truckRegistration;
  if (fields.driverName) data.driverName = fields.driverName;
  if (fields.transporter) data.transporter = fields.transporter;
  if (fields.loadedPmsLitres) data.loadedPmsLitres = fields.loadedPmsLitres;
  if (fields.loadedAgoLitres) data.loadedAgoLitres = fields.loadedAgoLitres;
  if (fields.loadingReference) data.loadingReference = fields.loadingReference;
  if (fields.sealNumbers) data.sealNumbers = fields.sealNumbers;
  if (fields.deliveryNoteRef) data.deliveryNoteRef = fields.deliveryNoteRef;
  if (action === "accept" || action === "receive-docs") data.loadingStartedAt = new Date();
  if (action === "release-station") data.dispatchedAt = new Date();
  if (action === "complete") data.loadingCompletedAt = new Date();
  if (action === "dispatch") {
    data.dispatchedAt = new Date();
  }
  if (action === "deliver") data.deliveredAt = new Date();

  let saved = await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId,
      from: order.status,
      to: map.to,
      actorId,
      note: map.note,
      data,
    })
  );

  if (action === "dispatch") {
    saved = await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: "DISPATCHED",
        to: "IN_TRANSIT",
        actorId,
        note: "In transit to station",
      })
    );
  }

  await logActivity({
    actorId,
    action: map.action,
    entity: "DealerOrder",
    entityId: orderId,
  });
  return saved;
}
