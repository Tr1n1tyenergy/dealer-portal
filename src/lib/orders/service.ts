import type { DealerOrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { resolveOdooPartnerId } from "@/lib/dealers/registry";
import { getOdooClient } from "@/lib/integrations/odoo/client";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { assertTransition } from "@/lib/orders/state-machine";

const orderInclude = {
  lines: true,
  station: true,
  dealerOrganization: true,
  depot: true,
  proforma: true,
  payments: true,
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.DealerOrderInclude;

export type OrderWithRelations = Prisma.DealerOrderGetPayload<{ include: typeof orderInclude }>;

async function nextReference(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
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
    data?: Prisma.DealerOrderUpdateInput;
  }
) {
  assertTransition(params.from, params.to);
  const order = await tx.dealerOrder.update({
    where: { id: params.orderId },
    data: { status: params.to, ...params.data },
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

export async function submitDealerOrder(params: {
  actorId: string;
  dealerOrganizationId: string;
  stationId: string;
  requestedDeliveryDate?: string | null;
  dealerReference?: string | null;
  notes?: string | null;
  lines: { product: "PMS" | "AGO"; quantityLitres: number }[];
}) {
  if (!params.lines.length) throw new Error("Add at least one product.");
  for (const line of params.lines) {
    if (!Number.isInteger(line.quantityLitres) || line.quantityLitres <= 0) {
      throw new Error("Quantities must be positive whole litres.");
    }
  }

  const station = await prisma.station.findFirst({
    where: { id: params.stationId, dealerOrganizationId: params.dealerOrganizationId },
    include: { dealerOrganization: true },
  });
  if (!station) throw new Error("That station is not available to this dealer.");

  const created = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    const order = await tx.dealerOrder.create({
      data: {
        reference,
        dealerOrganizationId: params.dealerOrganizationId,
        stationId: station.id,
        createdById: params.actorId,
        status: "SUBMITTED",
        requestedDeliveryDate: params.requestedDeliveryDate
          ? new Date(params.requestedDeliveryDate)
          : null,
        dealerReference: params.dealerReference || null,
        notes: params.notes || null,
        odooSyncKey: `quotation:${reference}`,
        lines: { create: params.lines },
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
    const quotation = await client.createQuotation({
      idempotencyKey: current.odooSyncKey,
      dealerCode: current.dealerOrganization.code,
      dealerName: current.dealerOrganization.name,
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
      lines: current.lines
        .filter((line) => line.product === "PMS" || line.product === "AGO")
        .map((line) => {
          const product = line.product as "PMS" | "AGO";
          return {
            product,
            quantityLitres: line.quantityLitres,
            unitPrice: stationCode ? epraUnitPriceForStation(stationCode, product) : null,
          };
        }),
    });

    const saved = await prisma.$transaction((tx) =>
      recordTransition(tx, {
        orderId,
        from: "ODOO_SYNC_PENDING",
        to: "QUOTATION_READY",
        actorId,
        note: `Odoo quotation ${quotation.number}`,
        data: {
          odooQuotationId: quotation.id,
          odooQuotationNumber: quotation.number,
          amountDue: quotation.amountTotal,
          currency: quotation.currency,
          odooSyncError: null,
        },
      })
    );
    await logActivity({
      actorId,
      action: "ODOO_QUOTATION_CREATED",
      entity: "DealerOrder",
      entityId: orderId,
      meta: { quotationNumber: quotation.number, mode: client.mode },
    });
    return saved;
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

export async function generatePfi(orderId: string, actorId: string) {
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  if (!order?.odooQuotationId) throw new Error("A quotation is required before a PFI.");

  const existing = await prisma.proFormaInvoice.findUnique({ where: { orderId } });
  if (existing) return order;

  await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId,
      from: order.status,
      to: "PFI_PENDING",
      actorId,
      note: "Requesting pro-forma from Odoo",
    })
  );

  const client = getOdooClient();
  const pfi = await client.generateProForma(order.odooQuotationId);
  const saved = await prisma.$transaction(async (tx) => {
    await tx.proFormaInvoice.create({
      data: {
        orderId,
        number: pfi.number,
        amount: pfi.amount,
        currency: pfi.currency,
        odooDocumentId: pfi.id,
      },
    });
    return recordTransition(tx, {
      orderId,
      from: "PFI_PENDING",
      to: "PFI_ISSUED",
      actorId,
      note: `PFI ${pfi.number}`,
      data: { amountDue: pfi.amount },
    });
  });
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
    meta: { number: pfi.number, mode: client.mode },
  });
  return saved;
}

export async function submitPayment(params: {
  orderId: string;
  actorId: string;
  dealerOrganizationId: string;
  amount: string;
  bankReference?: string;
  transactionReference?: string;
  paymentDate?: string;
  note?: string;
}) {
  const order = await prisma.dealerOrder.findFirst({
    where: { id: params.orderId, dealerOrganizationId: params.dealerOrganizationId },
  });
  if (!order) throw new Error("Order not found.");

  await prisma.paymentRecord.create({
    data: {
      orderId: order.id,
      amount: params.amount,
      bankReference: params.bankReference,
      transactionReference: params.transactionReference,
      paymentDate: params.paymentDate ? new Date(params.paymentDate) : null,
      note: params.note,
      submittedById: params.actorId,
      status: "SUBMITTED",
    },
  });

  const saved = await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId: order.id,
      from: order.status,
      to: "PAYMENT_SUBMITTED",
      actorId: params.actorId,
      note: "Dealer submitted payment details",
    })
  );
  await prisma.$transaction((tx) =>
    recordTransition(tx, {
      orderId: order.id,
      from: "PAYMENT_SUBMITTED",
      to: "PAYMENT_VERIFICATION",
      actorId: params.actorId,
      note: "Queued for finance verification",
    })
  );
  await logActivity({
    actorId: params.actorId,
    action: "PAYMENT_SUBMITTED",
    entity: "DealerOrder",
    entityId: order.id,
  });
  return saved;
}

export async function confirmPayment(orderId: string, actorId: string, accept: boolean) {
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");
  const to = accept ? "PAYMENT_CONFIRMED" : "PAYMENT_EXCEPTION";
  const saved = await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.updateMany({
      where: { orderId, status: { in: ["SUBMITTED", "VERIFICATION"] } },
      data: { status: accept ? "CONFIRMED" : "REJECTED" },
    });
    return recordTransition(tx, {
      orderId,
      from: order.status,
      to,
      actorId,
      note: accept ? "Payment confirmed" : "Payment needs review",
    });
  });
  await logActivity({
    actorId,
    action: accept ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED",
    entity: "DealerOrder",
    entityId: orderId,
  });
  return saved;
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
      data: { depot: { connect: { id: depot.id } } },
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
  actorId: string,
  action: "accept" | "complete" | "dispatch" | "deliver" | "close",
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
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");

  const map = {
    accept: { to: "LOADING" as const, action: "LOADING_STARTED", note: "Loading started" },
    complete: { to: "LOADED" as const, action: "LOADING_COMPLETED", note: "Loading complete" },
    dispatch: { to: "DISPATCHED" as const, action: "ORDER_DISPATCHED", note: "Truck dispatched" },
    deliver: { to: "DELIVERED" as const, action: "ORDER_DELIVERED", note: "Delivery confirmed" },
    close: { to: "CLOSED" as const, action: "ORDER_CLOSED", note: "Order closed" },
  }[action];

  const data: Prisma.DealerOrderUpdateInput = {};
  if (fields.truckRegistration) data.truckRegistration = fields.truckRegistration;
  if (fields.driverName) data.driverName = fields.driverName;
  if (fields.transporter) data.transporter = fields.transporter;
  if (fields.loadedPmsLitres) data.loadedPmsLitres = fields.loadedPmsLitres;
  if (fields.loadedAgoLitres) data.loadedAgoLitres = fields.loadedAgoLitres;
  if (fields.loadingReference) data.loadingReference = fields.loadingReference;
  if (fields.sealNumbers) data.sealNumbers = fields.sealNumbers;
  if (fields.deliveryNoteRef) data.deliveryNoteRef = fields.deliveryNoteRef;
  if (action === "accept") data.loadingStartedAt = new Date();
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

export async function getOrderForActor(orderId: string, actor: {
  id: string;
  accountType: string;
  role: string;
  dealerOrganizationId?: string | null;
  depotId?: string | null;
}) {
  const order = await prisma.dealerOrder.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) return null;
  if (actor.accountType === "DEALER" && order.dealerOrganizationId !== actor.dealerOrganizationId) return null;
  if (actor.accountType === "DEPOT" && order.depotId && actor.depotId && order.depotId !== actor.depotId && actor.role !== "SUPER_ADMIN") {
    return null;
  }
  if (actor.accountType === "DEPOT" && !order.depotId) return null;
  return order;
}
