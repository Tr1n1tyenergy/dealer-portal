/** Loads the rows Staff Analytics needs (bounded by date or count) and runs the pure insight functions. */
import type { DealerOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ORDER_STAGES } from "@/lib/orders/stages";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import { goneQuiet, litresByWarehouse, topDealers } from "./dealers";
import { cycleTimes, monthFigures, monthlyLitres } from "./figures";
import { eventText, stageCounts, stuckOrders, type InsightOrder } from "./live";

const OPEN_STATUSES = ORDER_STAGES.filter((s) => !["complete", "exceptions"].includes(s.key)).flatMap((s) => s.statuses);
const NOT_COUNTED: DealerOrderStatus[] = ["DRAFT", "CANCELLED", "REJECTED"];

const orderSelect = {
  id: true,
  reference: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  amountDue: true,
  dealerOrganization: { select: { name: true } },
  station: { select: { code: true, name: true, tradingName: true } },
  lines: { select: { product: true, quantityLitres: true } },
} as const;

export async function loadAnalytics(now: Date = new Date()) {
  const since = nairobiMonthStart(now, -11);

  // Wave 1: the last 12 months of orders, plus any order still open however old.
  const [recent, open] = await Promise.all([
    prisma.dealerOrder.findMany({ where: { createdAt: { gte: since, lte: now } }, select: orderSelect }),
    prisma.dealerOrder.findMany({ where: { status: { in: OPEN_STATUSES } }, select: orderSelect }),
  ]);
  const byId = new Map([...recent, ...open].map((o) => [o.id, o]));
  const orders: InsightOrder[] = [...byId.values()].map((o) => ({
    id: o.id,
    reference: o.reference,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    amountDue: o.amountDue,
    dealerName: o.dealerOrganization.name,
    stationName: o.station.tradingName || o.station.name,
    stationCode: o.station.code,
    lines: o.lines,
  }));
  const openOrders = orders.filter((o) => OPEN_STATUSES.includes(o.status));

  // Wave 2: history of those orders, the latest events, and each dealer's last order.
  const [history, latest, lastByDealer, totalDealers] = await Promise.all([
    prisma.orderStatusHistory.findMany({
      where: { orderId: { in: [...byId.keys()] }, createdAt: { lte: now } },
      select: { orderId: true, toStatus: true, createdAt: true },
    }),
    prisma.orderStatusHistory.findMany({
      where: { createdAt: { lte: now } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        toStatus: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            reference: true,
            dealerOrganization: { select: { name: true } },
            station: { select: { name: true, tradingName: true } },
            depot: { select: { name: true } },
          },
        },
      },
    }),
    prisma.dealerOrder.groupBy({
      by: ["dealerOrganizationId"],
      where: { status: { notIn: NOT_COUNTED }, createdAt: { lte: now } },
      _max: { createdAt: true },
    }),
    // Placeholder dealers created for unassigned stations are not real customers.
    prisma.dealerOrganization.count({ where: { NOT: { code: { endsWith: "-DUMMY" } } } }),
  ]);

  const names = new Map(
    (
      await prisma.dealerOrganization.findMany({
        where: { id: { in: lastByDealer.map((d) => d.dealerOrganizationId) } },
        select: { id: true, name: true },
      })
    ).map((d) => [d.id, d.name]),
  );

  return {
    updatedAt: now,
    stages: stageCounts(openOrders),
    stuckAll: stuckOrders(openOrders, history, now),
    events: latest.map((e) => ({
      orderId: e.order.id,
      status: e.toStatus,
      at: e.createdAt,
      text: eventText({
        toStatus: e.toStatus,
        reference: e.order.reference,
        dealerName: e.order.dealerOrganization.name,
        stationName: e.order.station.tradingName || e.order.station.name,
        depotName: e.order.depot?.name,
      }),
    })),
    figures: monthFigures(orders, now),
    totalDealers,
    monthly: monthlyLitres(orders, now),
    cycles: cycleTimes(history, now),
    warehouses: litresByWarehouse(orders, now),
    top: topDealers(orders, now),
    quiet: goneQuiet(
      lastByDealer.flatMap((d) =>
        d._max.createdAt && names.has(d.dealerOrganizationId)
          ? [{ name: names.get(d.dealerOrganizationId)!, lastOrderAt: d._max.createdAt }]
          : [],
      ),
      now,
    ),
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof loadAnalytics>>;
