import { redirect } from "next/navigation";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import { can } from "@/lib/access";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  RetailAnalyticsDashboard,
  type RecentOrderRow,
  type RetailKpi,
  type StatusSlice,
  type TrendPoint,
} from "@/components/retail/retail-analytics-dashboard";
import {
  type AnalyticsStatusBucket,
  analyticsStatusBucket,
  lastNMonthLabels,
  monthKey,
  pctChange,
  staffStatusPill,
} from "@/lib/retail/analytics";
import "@/app/intelligence/retail/retail-analytics.css";

function formatLitres(n: number) {
  return `${n.toLocaleString()} L`;
}

function formatDay(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
}

export default async function RetailDashboardPage() {
  const session = await requireInternal();
  if (!can(session.user.role, "retail.analytics")) redirect("/intelligence/dashboard");
  const now = new Date();
  // Month edges on the Nairobi calendar (servers run on UTC).
  const monthStart = nairobiMonthStart(now);
  const prevMonthStart = nairobiMonthStart(now, -1);
  const prevMonthEnd = monthStart;
  const sixMonthsAgo = nairobiMonthStart(now, -5);

  const lastDay = new Date(nairobiMonthStart(now, 1).getTime() - 1);
  const prettyRange = `${formatDay(monthStart)} – ${formatDay(lastDay)}`;

  // Two waves (not 7-way Promise.all) to stay within Neon/Prisma pool limits under Turbopack HMR
  const orders = await prisma.dealerOrder.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    include: {
      dealerOrganization: { select: { name: true } },
      station: { select: { name: true, tradingName: true } },
      lines: { select: { product: true, quantityLitres: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const [stationsCount, pendingInvites, prevPending, orgsNow, orgsPrev, stationsPrev] =
    await Promise.all([
      prisma.station.count(),
      prisma.user.count({
        where: { status: "PENDING", accountType: { in: ["DEALER", "INTERNAL"] } },
      }),
      prisma.user.count({
        where: {
          status: "PENDING",
          accountType: { in: ["DEALER", "INTERNAL"] },
          createdAt: { lt: monthStart },
        },
      }),
      prisma.dealerOrganization.count(),
      prisma.dealerOrganization.count({ where: { createdAt: { lt: monthStart } } }),
      prisma.station.count({ where: { createdAt: { lt: monthStart } } }),
    ]);

  const thisMonthOrders = orders.filter((o) => o.createdAt >= monthStart);
  const prevMonthOrders = orders.filter(
    (o) => o.createdAt >= prevMonthStart && o.createdAt < prevMonthEnd
  );

  const months = lastNMonthLabels(6, now);
  const trend: TrendPoint[] = months.map((m) => {
    const monthOrders = orders.filter((o) => monthKey(o.createdAt) === m.key);
    let pms = 0;
    let ago = 0;
    for (const o of monthOrders) {
      for (const line of o.lines) {
        if (line.product === "PMS") pms += 1;
        if (line.product === "AGO") ago += 1;
      }
    }
    return { label: m.label, pms, ago };
  });

  const bucketOrder: AnalyticsStatusBucket[] = [
    "Quotation Processing",
    "Awaiting Payment",
    "PFI Issued",
    "Depot Processing",
    "In Transit",
    "Delivered",
  ];
  const bucketCounts = Object.fromEntries(bucketOrder.map((b) => [b, 0])) as Record<
    AnalyticsStatusBucket,
    number
  >;
  for (const o of thisMonthOrders) {
    const b = analyticsStatusBucket(o.status);
    if (b) bucketCounts[b] += 1;
  }
  const monthTotal = thisMonthOrders.length;
  const statusSlices: StatusSlice[] = bucketOrder.map((bucket) => ({
    bucket,
    count: bucketCounts[bucket],
    pct: monthTotal ? Math.round((bucketCounts[bucket] / monthTotal) * 100) : 0,
  }));

  const sparkFromTrend = (pick: "pms" | "ago" | "total") =>
    trend.map((t) => (pick === "total" ? t.pms + t.ago : t[pick]));

  const kpis: RetailKpi[] = [
    {
      label: "Total Orders",
      value: thisMonthOrders.length,
      deltaPct: pctChange(thisMonthOrders.length, prevMonthOrders.length),
      spark: sparkFromTrend("total"),
      tone: "blue",
      icon: "orders",
    },
    {
      label: "Pending Invites",
      value: pendingInvites,
      deltaPct: pctChange(pendingInvites, prevPending),
      spark: [Math.max(prevPending - 2, 0), prevPending, pendingInvites, pendingInvites],
      tone: "gold",
      icon: "invites",
    },
    {
      label: "Dealer Organisations",
      value: orgsNow,
      deltaPct: pctChange(orgsNow, orgsPrev),
      spark: [Math.max(orgsPrev - 1, 0), orgsPrev, orgsNow, orgsNow],
      tone: "purple",
      icon: "orgs",
    },
    {
      label: "Retail Stations",
      value: stationsCount,
      deltaPct: pctChange(stationsCount, stationsPrev),
      spark: [Math.max(stationsPrev - 1, 0), stationsPrev, stationsCount, stationsCount],
      tone: "green",
      icon: "stations",
    },
  ];

  const recentOrders: RecentOrderRow[] = orders.slice(0, 8).map((o) => {
    const pill = staffStatusPill(o.status);
    const products = Array.from(new Set(o.lines.map((l) => l.product))).join(" · ") || "—";
    const volume = o.lines.reduce((s, l) => s + l.quantityLitres, 0);
    return {
      id: o.id,
      reference: o.reference,
      dealer: o.dealerOrganization.name,
      station: o.station.tradingName || o.station.name,
      products,
      volume: volume ? formatLitres(volume) : "—",
      status: pill.label,
      tone: pill.tone,
      created: formatDay(o.createdAt),
    };
  });

  const volumeByStation = new Map<string, number>();
  for (const o of thisMonthOrders) {
    const name = o.station.tradingName || o.station.name;
    const vol = o.lines.reduce((s, l) => s + l.quantityLitres, 0);
    volumeByStation.set(name, (volumeByStation.get(name) ?? 0) + vol);
  }
  const stationSorted = [...volumeByStation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxVol = stationSorted[0]?.[1] ?? 0;
  const topStations = stationSorted.map(([name, litres]) => ({
    name,
    litres,
    pct: maxVol ? Math.round((litres / maxVol) * 100) : 0,
  }));

  const welcomeName =
    session.user.role === "SUPER_ADMIN"
      ? "Admin"
      : session.user.firstName || "there";

  return (
    <RetailAnalyticsDashboard
      welcomeName={welcomeName}
      dateRangeLabel={prettyRange}
      kpis={kpis}
      trend={trend}
      statusSlices={statusSlices}
      totalOrders={monthTotal}
      recentOrders={recentOrders}
      topStations={topStations}
    />
  );
}
