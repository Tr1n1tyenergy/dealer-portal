import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  StaffHomeDashboard,
  type StaffHomeActivity,
  type StaffHomeKpi,
  type StaffHomeRank,
  type StaffHomeTask,
} from "@/components/staff/staff-home-dashboard";
import {
  IN_TRANSIT_STATUSES,
  ONGOING_ORDER_STATUSES,
  PAYMENT_REVIEW_STATUSES,
  WAITING_PAYMENT_STATUSES,
  formatKes,
  formatLitres,
  formatWaitDuration,
  greetingForHour,
  nextEpraEffectiveAt,
  nairobiTodayStart,
  nairobiYesterdayStart,
  pctChange,
  relativeTimeLabel,
  sumPaymentsToday,
  thisMonthBounds,
} from "@/lib/retail/staff-home";
import { nairobiParts } from "@/lib/time/nairobi";
import "@/app/intelligence/retail/staff-home.css";

export default async function StaffHomePage() {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view") && !canUser(session.user, "orders", "view")) {
    redirect("/intelligence/dashboard");
  }

  const now = new Date();
  const todayStart = nairobiTodayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = nairobiYesterdayStart(now);
  const { start: monthStart, end: monthEnd } = thisMonthBounds(now);
  const epraAt = nextEpraEffectiveAt(now);
  const { hour } = nairobiParts(now);

  const [
    ongoingNow,
    ongoingYesterday,
    payments,
    transitOrders,
    waitingOrders,
    paymentReviewCount,
    stations,
    closedYesterday,
    recentHistory,
    recentPayments,
    recentReports,
    monthSalesReports,
  ] = await Promise.all([
    prisma.dealerOrder.count({ where: { status: { in: ONGOING_ORDER_STATUSES } } }),
    prisma.dealerOrder.count({
      where: {
        status: { in: ONGOING_ORDER_STATUSES },
        updatedAt: { lt: todayStart },
      },
    }),
    prisma.paymentRecord.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { paymentDate: { gte: todayStart, lt: tomorrowStart } },
          {
            paymentDate: null,
            createdAt: { gte: todayStart, lt: tomorrowStart },
          },
        ],
      },
      select: { status: true, amount: true, paymentDate: true, createdAt: true },
    }),
    prisma.dealerOrder.findMany({
      where: { status: { in: IN_TRANSIT_STATUSES } },
      include: { lines: { select: { product: true, quantityLitres: true } } },
    }),
    prisma.dealerOrder.findMany({
      where: { status: { in: WAITING_PAYMENT_STATUSES } },
      include: {
        dealerOrganization: { select: { name: true } },
        proforma: { select: { issuedAt: true } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.dealerOrder.count({ where: { status: { in: PAYMENT_REVIEW_STATUSES } } }),
    prisma.station.findMany({
      select: { id: true, name: true, tradingName: true, dealerOrganizationId: true },
    }),
    prisma.stockSaleReport.findMany({
      where: {
        reportingDate: yesterdayStart,
        status: "CLOSED",
      },
      select: { stationId: true },
    }),
    prisma.orderStatusHistory.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            reference: true,
            status: true,
            dealerOrganization: { select: { name: true } },
            station: { select: { name: true, tradingName: true } },
            depot: { select: { name: true } },
            proforma: { select: { number: true } },
          },
        },
      },
    }),
    prisma.paymentRecord.findMany({
      where: { status: "CONFIRMED" },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            reference: true,
            dealerOrganization: { select: { name: true } },
          },
        },
      },
    }),
    prisma.stockSaleReport.findMany({
      where: { status: "CLOSED" },
      take: 8,
      orderBy: { closedAt: "desc" },
      include: {
        dealerOrganization: { select: { name: true } },
        station: { select: { name: true, tradingName: true } },
      },
    }),
    prisma.stockSaleReport.findMany({
      where: {
        status: "CLOSED",
        reportingDate: { gte: monthStart, lt: monthEnd },
      },
      include: {
        station: { select: { name: true, tradingName: true } },
      },
    }),
  ]);

  const payToday = sumPaymentsToday(payments, todayStart, tomorrowStart);

  let transitPms = 0;
  let transitAgo = 0;
  for (const o of transitOrders) {
    for (const line of o.lines) {
      if (line.product === "PMS") transitPms += line.quantityLitres;
      if (line.product === "AGO") transitAgo += line.quantityLitres;
    }
  }
  const transitTotal = transitPms + transitAgo;

  const waitingDealers = new Map<
    string,
    { name: string; since: Date }
  >();
  for (const o of waitingOrders) {
    const since = o.proforma?.issuedAt ?? o.updatedAt;
    const prev = waitingDealers.get(o.dealerOrganizationId);
    if (!prev || since < prev.since) {
      waitingDealers.set(o.dealerOrganizationId, {
        name: o.dealerOrganization.name,
        since,
      });
    }
  }
  const waitingList = [...waitingDealers.values()].sort(
    (a, b) => a.since.getTime() - b.since.getTime()
  );
  const longest = waitingList[0];

  const closedStationIds = new Set(closedYesterday.map((r) => r.stationId));
  const missingStations = stations.filter((s) => !closedStationIds.has(s.id));
  const missingCount = missingStations.length;

  const delta = pctChange(ongoingNow, ongoingYesterday);
  const deltaLabel =
    delta === null
      ? "vs yesterday"
      : `${delta >= 0 ? "↑ +" : "↓ "}${Math.abs(delta)}% vs yesterday`;

  const kpis: StaffHomeKpi[] = [
    {
      key: "ongoing",
      label: "Ongoing Orders",
      value: String(ongoingNow),
      meta: deltaLabel,
      metaTone: delta !== null && delta >= 0 ? "up" : "muted",
      href: "/intelligence/retail/orders?stage=all",
      tone: "blue",
      icon: "layers",
    },
    {
      key: "payments",
      label: "Payments Made Today",
      value: formatKes(payToday.total),
      meta: `${payToday.count} payment${payToday.count === 1 ? "" : "s"} confirmed`,
      href: "/intelligence/retail/orders?stage=checking-payment",
      tone: "gold",
      icon: "wallet",
    },
    {
      key: "transit",
      label: "Orders in Transit",
      value: formatLitres(transitTotal),
      meta: `${transitOrders.length} deliver${transitOrders.length === 1 ? "y" : "ies"} (PMS: ${formatLitres(transitPms).replace(" L", "")} L, AGO: ${formatLitres(transitAgo).replace(" L", "")} L)`,
      href: "/intelligence/retail/orders?stage=depot",
      tone: "blue",
      icon: "truck",
    },
    {
      key: "waiting",
      label: "Dealers Waiting for Orders",
      value: String(waitingDealers.size),
      meta: longest
        ? `Longest wait: ${longest.name} (${formatWaitDuration(now.getTime() - longest.since.getTime())})`
        : "No dealers awaiting payment",
      href: "/intelligence/retail/orders?stage=awaiting-payment",
      tone: "purple",
      icon: "users",
    },
  ];

  const epraMs = epraAt.getTime() - now.getTime();
  const epraDays = Math.max(0, Math.ceil(epraMs / (24 * 60 * 60 * 1000)));
  const epraLabel = epraAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });

  // Only surface tasks that have real outstanding work — never pad with mockup rows.
  const tasks: StaffHomeTask[] = [];
  if (paymentReviewCount > 0) {
    tasks.push({
      key: "payments",
      title: "Payment Confirmation",
      description:
        paymentReviewCount === 1
          ? "1 order has payment awaiting confirmation to create Sale Orders."
          : `${paymentReviewCount} orders have payments awaiting confirmation to create Sale Orders.`,
      badge: `${paymentReviewCount} Pending`,
      badgeTone: "pending",
      actionLabel: "Review Payments →",
      actionHref: "/intelligence/retail/orders?stage=checking-payment",
      actionVariant: "yellow",
      icon: "coins",
    });
  }
  if (missingCount > 0) {
    tasks.push({
      key: "reports",
      title: "Missing Sale & Stock Reports",
      description:
        missingCount === 1
          ? "1 station has not submitted yesterday’s Sale & Stock report."
          : `${missingCount} stations have not submitted yesterday’s Sale & Stock report.`,
      badge: `${missingCount} Overdue`,
      badgeTone: "overdue",
      actionLabel: "Notify Dealers →",
      actionHref: "/intelligence/retail/messaging",
      actionVariant: "outline",
      icon: "report",
    });
  }
  // EPRA reminder only when the next 15th is within a week (real upcoming change window).
  if (epraDays <= 7) {
    tasks.push({
      key: "epra",
      title: "EPRA Price Update",
      description: `The next EPRA price change takes effect on ${epraLabel} (00:00 hrs, Africa/Nairobi).`,
      badge: `Due in ${epraDays} day${epraDays === 1 ? "" : "s"}`,
      badgeTone: "due",
      actionLabel: "Update Prices →",
      actionHref: "/intelligence/admin/settings",
      actionVariant: "outline",
      icon: "tag",
    });
  }

  type FeedItem = StaffHomeActivity & { at: Date };
  const feed: FeedItem[] = [];

  for (const p of recentPayments) {
    feed.push({
      id: `pay-${p.id}`,
      at: p.createdAt,
      text: `${p.order.dealerOrganization.name} has just paid for ${p.order.reference}`,
      timeLabel: relativeTimeLabel(p.createdAt, now),
      href: `/intelligence/retail/orders?q=${encodeURIComponent(p.order.reference)}`,
      tone: "ok",
      icon: "check",
    });
  }

  for (const h of recentHistory) {
    const dealer = h.order.dealerOrganization.name;
    const ref = h.order.reference;
    const to = h.toStatus;
    let text = `${ref} updated to ${to.replaceAll("_", " ").toLowerCase()}`;
    let icon: StaffHomeActivity["icon"] = "doc";
    let tone: StaffHomeActivity["tone"] = "info";

    if (to === "PFI_ISSUED") {
      const pfi = h.order.proforma?.number;
      text = pfi
        ? `PFI issued to ${dealer} (${pfi})`
        : `PFI issued to ${dealer} for ${ref}`;
      icon = "doc";
    } else if (to === "IN_TRANSIT" || to === "DISPATCHED") {
      const depot = h.order.depot?.name;
      text = depot
        ? `${ref} is currently in transit from ${depot}`
        : `${ref} is currently in transit`;
      icon = "truck";
    } else if (to === "DELIVERED" || to === "RELEASED_TO_DEPOT") {
      const station = h.order.station.tradingName || h.order.station.name;
      text = `${ref} released to ${station}`;
      icon = "truck";
      tone = "ok";
    } else if (to === "PAYMENT_CONFIRMED") {
      text = `${dealer} payment confirmed for ${ref}`;
      icon = "check";
      tone = "ok";
    }

    feed.push({
      id: `hist-${h.id}`,
      at: h.createdAt,
      text,
      timeLabel: relativeTimeLabel(h.createdAt, now),
      href: `/intelligence/retail/orders?q=${encodeURIComponent(ref)}`,
      tone,
      icon,
    });
  }

  for (const r of recentReports) {
    if (!r.closedAt) continue;
    const station = r.station.tradingName || r.station.name;
    feed.push({
      id: `ssr-${r.id}`,
      at: r.closedAt,
      text: `${r.dealerOrganization.name} has just submitted their Sale & Stock report${station ? ` (${station})` : ""}`,
      timeLabel: relativeTimeLabel(r.closedAt, now),
      href: "/intelligence/retail/analytics",
      tone: "ok",
      icon: "check",
    });
  }

  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  const activity: StaffHomeActivity[] = feed.slice(0, 6).map(({ at: _at, ...rest }) => rest);

  const salesByStation = new Map<string, number>();
  const lossByStation = new Map<string, { litres: number; sales: number }>();
  for (const r of monthSalesReports) {
    const name = r.station.tradingName || r.station.name;
    const collections = Number(r.collectionsKes ?? 0);
    if (Number.isFinite(collections) && collections > 0) {
      salesByStation.set(name, (salesByStation.get(name) ?? 0) + collections);
    }
    const loss = Math.max(0, Number(r.wetAbsoluteVarianceLitres ?? r.wetVarianceTotalLitres ?? 0));
    const sold = Math.max(0, Number(r.totalSalesLitres ?? 0));
    if (loss > 0) {
      const prev = lossByStation.get(name) ?? { litres: 0, sales: 0 };
      lossByStation.set(name, { litres: prev.litres + loss, sales: prev.sales + sold });
    }
  }

  const salesSorted = [...salesByStation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const salesMax = salesSorted[0]?.[1] ?? 0;
  const salesRanks: StaffHomeRank[] = salesSorted.map(([name, value]) => ({
    name,
    valueLabel: formatKes(value),
    pct: salesMax ? Math.max(8, Math.round((value / salesMax) * 100)) : 0,
  }));

  const lossSorted = [...lossByStation.entries()]
    .sort((a, b) => b[1].litres - a[1].litres)
    .slice(0, 3);
  const lossMax = lossSorted[0]?.[1].litres ?? 0;
  const lossRanks: StaffHomeRank[] = lossSorted.map(([name, row]) => {
    const pctLoss = row.sales > 0 ? (row.litres / row.sales) * 100 : 0;
    return {
      name,
      valueLabel: `${row.litres.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} L (${pctLoss.toFixed(2)}%)`,
      pct: lossMax ? Math.max(8, Math.round((row.litres / lossMax) * 100)) : 0,
    };
  });

  const displayName =
    session.user.role === "SUPER_ADMIN"
      ? "Admin"
      : session.user.firstName || "there";

  return (
    <StaffHomeDashboard
      greeting={greetingForHour(hour)}
      displayName={displayName}
      kpis={kpis}
      tasks={tasks}
      activity={activity}
      salesRanks={salesRanks}
      lossRanks={lossRanks}
      epra={{
        effectiveLabel: epraLabel,
        targetMs: epraAt.getTime(),
        hasUpcoming: true,
      }}
    />
  );
}
