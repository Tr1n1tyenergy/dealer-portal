import type { ProductCode, StockReceiptBalanceEffect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/orders/state-machine";
import { formatStockReportDate, nairobiBusinessDate } from "./dates";
import { centsToLitres, litresToCents } from "./pump-calc";
import { calculateTankDip, sumTankSalesByProduct } from "./tank-calc";
import { writeTankDipRows } from "./bulk-litre-writes";
import { StockReportingError } from "./service";

const FUEL: Array<"PMS" | "AGO"> = ["PMS", "AGO"];

export function addLitres(left: number, right: number): number {
  return centsToLitres(litresToCents(left) + litresToCents(right));
}

/**
 * Stock level after this order's new split.
 * A receipt already folded into the closing/opening is removed before the new litres are added.
 */
export function receiptLevelLitres(params: {
  bookLitres: number;
  alreadyInBook: boolean;
  previousLitres: number;
  nextLitres: number;
  otherReportReceiptLitres: number;
}): number {
  const removed = params.alreadyInBook ? params.previousLitres : 0;
  return addLitres(
    addLitres(addLitres(params.bookLitres, -removed), params.otherReportReceiptLitres),
    params.nextLitres
  );
}

export type ReceiptTankInput = {
  tankKey: string;
  product: "PMS" | "AGO";
  capacityLitres: number;
  bookLitres: number;
  alreadyInBook: boolean;
  previousLitres: number;
  otherReportReceiptLitres: number;
};

export function validateReceiptAllocation(params: {
  orderedPms: number;
  orderedAgo: number;
  tanks: ReceiptTankInput[];
  nextByTank: Map<string, number>;
}): { ok: true } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const ordered = { PMS: params.orderedPms, AGO: params.orderedAgo };
  const received = { PMS: 0, AGO: 0 };
  let any = false;

  for (const [tankKey, litres] of params.nextByTank) {
    if (!params.tanks.some((tank) => tank.tankKey === tankKey)) {
      fieldErrors[tankKey] = "That tank is not on this station.";
    }
    if (litres < 0) fieldErrors[tankKey] = "Litres cannot be negative.";
    if (litres > 0) any = true;
  }

  for (const tank of params.tanks) {
    const next = params.nextByTank.get(tank.tankKey) ?? 0;
    if (next > 0 && ordered[tank.product] <= 0) {
      fieldErrors[tank.tankKey] = `This order has no ${tank.product}.`;
    }
    received[tank.product] = addLitres(received[tank.product], next);
    const level = receiptLevelLitres({
      bookLitres: tank.bookLitres,
      alreadyInBook: tank.alreadyInBook,
      previousLitres: tank.previousLitres,
      nextLitres: next,
      otherReportReceiptLitres: tank.otherReportReceiptLitres,
    });
    if (level < -0.001) fieldErrors[tank.tankKey] = "That would take the tank below zero.";
    if (tank.capacityLitres > 0 && level > tank.capacityLitres + 0.001) {
      fieldErrors[tank.tankKey] = "That would exceed this tank's capacity.";
    }
  }

  for (const product of FUEL) {
    if (received[product] > ordered[product] + 0.001) {
      const message = `${product} receipted (${received[product].toLocaleString("en-US")} L) is more than the order (${ordered[product].toLocaleString("en-US")} L).`;
      for (const tank of params.tanks) {
        if (tank.product === product && (params.nextByTank.get(tank.tankKey) ?? 0) > 0) {
          fieldErrors[tank.tankKey] = fieldErrors[tank.tankKey] ?? message;
        }
      }
      if (!Object.values(fieldErrors).includes(message)) {
        fieldErrors[product] = message;
      }
    }
  }

  if (!any) {
    return {
      ok: false,
      error: "Enter the litres received into at least one tank.",
      fieldErrors,
    };
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Check the litres for each tank.", fieldErrors };
  }
  return { ok: true };
}

export async function onReportReceiptLitres(stationId: string, reportingDate: Date) {
  const lines = await prisma.stockReceiptLine.findMany({
    where: {
      receipt: { stationId, reportingDate, balanceEffect: "ON_REPORT" },
    },
    select: { tankKey: true, litres: true },
  });
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.tankKey, addLitres(map.get(line.tankKey) ?? 0, line.litres));
  }
  return map;
}

export type StockReceiptTankDto = {
  tankKey: string;
  label: string;
  product: "PMS" | "AGO";
  capacityLitres: number;
  /** Stock before today's on-report receipts. Folded receipts are already inside this figure. */
  bookLitres: number;
};

export type StockReceiptOrderDto = {
  id: string;
  reference: string;
  deliveredLabel: string;
  orderedPms: number;
  orderedAgo: number;
  savedLines: { tankKey: string; litres: number }[];
  locked: boolean;
};

export async function listStockReceiptWorkspace(params: {
  dealerOrganizationId: string;
  stationId: string;
  reportingDate: Date;
}): Promise<{ tanks: StockReceiptTankDto[]; orders: StockReceiptOrderDto[]; reportClosed: boolean }> {
  const [tanks, report, orders] = await Promise.all([
    prisma.stationTank.findMany({
      where: { stationId: params.stationId, active: true, product: { in: ["PMS", "AGO"] } },
      orderBy: [{ sortOrder: "asc" }, { tankKey: "asc" }],
    }),
    prisma.stockSaleReport.findUnique({
      where: {
        stationId_reportingDate: { stationId: params.stationId, reportingDate: params.reportingDate },
      },
      include: { tankReadings: true },
    }),
    prisma.dealerOrder.findMany({
      where: {
        stationId: params.stationId,
        dealerOrganizationId: params.dealerOrganizationId,
        status: { in: ["IN_TRANSIT", "DELIVERED", "CLOSED"] },
        OR: [{ stockReceipt: { is: null } }, { stockReceipt: { is: { reportingDate: params.reportingDate } } }],
      },
      include: { lines: true, stockReceipt: { include: { lines: true } } },
      orderBy: [{ deliveredAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const readingByKey = new Map((report?.tankReadings ?? []).map((row) => [row.tankKey, row]));
  const foldedLines = orders.flatMap((order) =>
    order.stockReceipt?.balanceEffect === "ON_LAST_CLOSING" ? order.stockReceipt.lines : []
  );
  const bookByKey = new Map<string, number>();
  for (const tank of tanks) {
    const reading = readingByKey.get(tank.tankKey);
    let book = reading?.openingLitres ?? tank.lastClosingLitres;
    for (const line of foldedLines) {
      if (line.tankKey === tank.tankKey) book = addLitres(book, -line.litres);
    }
    bookByKey.set(tank.tankKey, book);
  }

  return {
    reportClosed: report?.status === "CLOSED",
    tanks: tanks
      .filter((tank): tank is typeof tank & { product: "PMS" | "AGO" } => tank.product === "PMS" || tank.product === "AGO")
      .map((tank) => ({
        tankKey: tank.tankKey,
        label: tank.label,
        product: tank.product,
        capacityLitres: tank.capacityLitres,
        bookLitres: bookByKey.get(tank.tankKey) ?? tank.lastClosingLitres,
      })),
    orders: orders.map((order) => ({
      id: order.id,
      reference: order.reference,
      deliveredLabel: order.deliveredAt
        ? formatStockReportDate(nairobiBusinessDate(order.deliveredAt))
        : "Completed",
      orderedPms: order.lines.reduce((sum, line) => (line.product === "PMS" ? sum + line.quantityLitres : sum), 0),
      orderedAgo: order.lines.reduce((sum, line) => (line.product === "AGO" ? sum + line.quantityLitres : sum), 0),
      savedLines:
        order.stockReceipt?.lines.map((line) => ({ tankKey: line.tankKey, litres: line.litres })) ?? [],
      locked: report?.status === "CLOSED",
    })),
  };
}

/** Current stock for staff intelligence: physical close once dips are done, otherwise book plus today's receipts. */
export async function currentTankStockLitres(stationId: string, reportingDate: Date) {
  const [tanks, report, receipts] = await Promise.all([
    prisma.stationTank.findMany({
      where: { stationId, active: true },
      select: { tankKey: true, lastClosingLitres: true },
    }),
    prisma.stockSaleReport.findUnique({
      where: { stationId_reportingDate: { stationId, reportingDate } },
      include: { tankReadings: { select: { tankKey: true, openingLitres: true, closingLitres: true } } },
    }),
    prisma.stockReceipt.findMany({
      where: { stationId, reportingDate, balanceEffect: "ON_REPORT" },
      include: { lines: { select: { tankKey: true, litres: true } } },
    }),
  ]);
  const onReport = new Map<string, number>();
  for (const receipt of receipts) {
    for (const line of receipt.lines) {
      onReport.set(line.tankKey, addLitres(onReport.get(line.tankKey) ?? 0, line.litres));
    }
  }
  const readingByKey = new Map((report?.tankReadings ?? []).map((row) => [row.tankKey, row]));
  const dipsDone = report?.status === "CLOSED" || report?.tankDipsCompletedAt != null;
  const map = new Map<string, number>();
  for (const tank of tanks) {
    const reading = readingByKey.get(tank.tankKey);
    if (dipsDone) {
      map.set(tank.tankKey, reading?.closingLitres ?? tank.lastClosingLitres);
      continue;
    }
    if (reading) {
      map.set(tank.tankKey, addLitres(reading.openingLitres, onReport.get(tank.tankKey) ?? 0));
      continue;
    }
    map.set(tank.tankKey, tank.lastClosingLitres);
  }
  return map;
}

async function refreshReportForReceipts(
  reportId: string,
  stationId: string,
  reportingDate: Date
) {
  const [report, extra] = await Promise.all([
    prisma.stockSaleReport.findUnique({
      where: { id: reportId },
      include: { tankReadings: true },
    }),
    onReportReceiptLitres(stationId, reportingDate),
  ]);
  if (!report || report.status === "CLOSED" || report.tankReadings.length === 0) return;

  const computed = report.tankReadings.map((row) => {
    const opening = addLitres(row.openingLitres, extra.get(row.tankKey) ?? 0);
    if (row.closingLitres == null) {
      return {
        tankKey: row.tankKey,
        openingLitres: row.openingLitres,
        closingLitres: null,
        salesLitres: null,
        ullageLitres: null,
        product: row.product,
      };
    }
    const calc = calculateTankDip({
      capacity: row.capacityLitres,
      opening,
      closing: row.closingLitres,
    });
    return {
      tankKey: row.tankKey,
      openingLitres: row.openingLitres,
      closingLitres: row.closingLitres,
      salesLitres: calc.ok ? calc.sales : null,
      ullageLitres: calc.ok ? calc.ullage : null,
      product: row.product,
    };
  });
  const totals = sumTankSalesByProduct(
    computed.map((row) => ({ product: row.product, sales: row.salesLitres }))
  );

  await prisma.$transaction(async (tx) => {
    const written = await writeTankDipRows(tx, report.id, computed);
    if (written !== computed.length) {
      throw new StockReportingError("Could not update tank stock after the receipt.", "CONFLICT");
    }
    await tx.stockSaleReport.update({
      where: { id: report.id },
      data: {
        revision: { increment: 1 },
        tankSalesPmsLitres: totals.pms,
        tankSalesAgoLitres: totals.ago,
        tankDipsCompletedAt: null,
        wetStockCompletedAt: null,
        wetResolution: "NONE",
        wetState: "NOT_STARTED",
        wetLossReason: null,
        wetLossAcknowledgedAt: null,
        wetLossAcknowledgedById: null,
        monetaryCompletedAt: null,
        expectedRevenueKes: null,
        expectedPmsKes: null,
        expectedAgoKes: null,
        collectionsKes: null,
        cashCollectionsKes: null,
        mpesaCollectionsKes: null,
        cardCollectionsKes: null,
        monetaryDifferenceKes: null,
        monetaryState: "NOT_STARTED",
        monetaryDiscrepancyReason: null,
      },
    });
  });
}

export async function saveStockReceipt(params: {
  dealerOrganizationId: string;
  stationId: string;
  orderId: string;
  userId: string;
  reportingDate: Date;
  allocations: { tankKey: string; litres: number }[];
}) {
  const order = await prisma.dealerOrder.findFirst({
    where: {
      id: params.orderId,
      stationId: params.stationId,
      dealerOrganizationId: params.dealerOrganizationId,
      status: { in: ["IN_TRANSIT", "DELIVERED", "CLOSED"] },
    },
    include: { lines: true, stockReceipt: { include: { lines: true } } },
  });
  if (!order) throw new StockReportingError("That order was not found for this station.", "NOT_FOUND");
  if (order.stockReceipt && order.stockReceipt.reportingDate.getTime() !== params.reportingDate.getTime()) {
    throw new StockReportingError("This order was already receipted on another day.", "CONFLICT");
  }

  const [tanks, report, todaysReceipts] = await Promise.all([
    prisma.stationTank.findMany({
      where: { stationId: params.stationId, active: true, product: { in: ["PMS", "AGO"] } },
    }),
    prisma.stockSaleReport.findUnique({
      where: {
        stationId_reportingDate: { stationId: params.stationId, reportingDate: params.reportingDate },
      },
      include: { tankReadings: true },
    }),
    prisma.stockReceipt.findMany({
      where: { stationId: params.stationId, reportingDate: params.reportingDate },
      include: { lines: true },
    }),
  ]);
  if (report?.status === "CLOSED") {
    throw new StockReportingError(
      "Today's stock report is closed. Receipt this order on the next reporting day.",
      "CLOSED"
    );
  }

  const nextByTank = new Map<string, number>();
  for (const row of params.allocations) {
    if (!Number.isFinite(row.litres)) continue;
    nextByTank.set(row.tankKey, row.litres);
  }
  const previous = new Map(
    (order.stockReceipt?.lines ?? []).map((line) => [line.tankKey, line.litres] as const)
  );
  const effect: StockReceiptBalanceEffect =
    order.stockReceipt?.balanceEffect ?? (report?.tankReadings.length ? "ON_REPORT" : "ON_LAST_CLOSING");
  const readingByKey = new Map((report?.tankReadings ?? []).map((row) => [row.tankKey, row]));

  const otherOnReport = new Map<string, number>();
  for (const receipt of todaysReceipts) {
    if (receipt.orderId === order.id || receipt.balanceEffect !== "ON_REPORT") continue;
    for (const line of receipt.lines) {
      otherOnReport.set(line.tankKey, addLitres(otherOnReport.get(line.tankKey) ?? 0, line.litres));
    }
  }

  const tankInputs: ReceiptTankInput[] = tanks
    .filter((tank): tank is typeof tank & { product: "PMS" | "AGO" } => tank.product === "PMS" || tank.product === "AGO")
    .map((tank) => {
      const reading = readingByKey.get(tank.tankKey);
      return {
        tankKey: tank.tankKey,
        product: tank.product,
        capacityLitres: tank.capacityLitres,
        bookLitres: reading?.openingLitres ?? tank.lastClosingLitres,
        alreadyInBook: effect === "ON_LAST_CLOSING",
        previousLitres: previous.get(tank.tankKey) ?? 0,
        otherReportReceiptLitres: otherOnReport.get(tank.tankKey) ?? 0,
      };
    });

  const check = validateReceiptAllocation({
    orderedPms: order.lines.reduce((sum, line) => (line.product === "PMS" ? sum + line.quantityLitres : sum), 0),
    orderedAgo: order.lines.reduce((sum, line) => (line.product === "AGO" ? sum + line.quantityLitres : sum), 0),
    tanks: tankInputs,
    nextByTank,
  });
  if (!check.ok) throw new StockReportingError(check.error, "VALIDATION", check.fieldErrors);

  const tankByKey = new Map(tanks.map((tank) => [tank.tankKey, tank]));
  const lines = [...nextByTank.entries()].flatMap(([tankKey, litres]) => {
    if (litres <= 0) return [];
    const tank = tankByKey.get(tankKey);
    if (!tank || (tank.product !== "PMS" && tank.product !== "AGO")) return [];
    return [{ tankId: tank.id, tankKey, product: tank.product as ProductCode, litres }];
  });

  await prisma.$transaction(async (tx) => {
    if (effect === "ON_LAST_CLOSING") {
      for (const tank of tankInputs) {
        const next = nextByTank.get(tank.tankKey) ?? 0;
        const delta = addLitres(next, -tank.previousLitres);
        if (delta === 0) continue;
        await tx.stationTank.update({
          where: { id: tankByKey.get(tank.tankKey)!.id },
          data: { lastClosingLitres: { increment: delta } },
        });
        const reading = readingByKey.get(tank.tankKey);
        if (reading) {
          await tx.stockSaleTankReading.update({
            where: { id: reading.id },
            data: { openingLitres: { increment: delta } },
          });
        }
      }
    }

    const receipt = order.stockReceipt
      ? await tx.stockReceipt.update({
          where: { id: order.stockReceipt.id },
          data: { balanceEffect: effect, reportingDate: params.reportingDate },
        })
      : await tx.stockReceipt.create({
          data: {
            orderId: order.id,
            stationId: params.stationId,
            dealerOrganizationId: params.dealerOrganizationId,
            reportingDate: params.reportingDate,
            balanceEffect: effect,
            createdById: params.userId,
          },
        });

    await tx.stockReceiptLine.deleteMany({ where: { receiptId: receipt.id } });
    if (lines.length) {
      await tx.stockReceiptLine.createMany({
        data: lines.map((line) => ({ ...line, receiptId: receipt.id })),
      });
    }

    if (order.status === "IN_TRANSIT") {
      assertTransition("IN_TRANSIT", "DELIVERED");
      const moved = await tx.dealerOrder.updateMany({
        where: { id: order.id, status: "IN_TRANSIT" },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      if (moved.count === 1) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: "IN_TRANSIT",
            toStatus: "DELIVERED",
            actorId: params.userId,
            note: "Receipted at the station",
          },
        });
      }
    }
  });

  if (report) await refreshReportForReceipts(report.id, params.stationId, params.reportingDate);
}
