import { redirect } from "next/navigation";
import type { DealerOrderStatus } from "@prisma/client";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pctChange } from "@/lib/retail/analytics";
import { monthlyLitres } from "@/lib/dealer/dashboard-summary";
import { cycleMedians, eventLine, stageCounts, STAGE_TILES, stuckOrders } from "@/lib/insights/order-flow";
import { goneQuiet, monthFigures, regionTotals, topDealers } from "@/lib/insights/business";
import { ORDERS_STAFF_CHANNEL } from "@/lib/pusher/server-channels";
import { PageHead } from "@/components/layout/page-head";
import { LiveRefresh } from "@/components/live/live-refresh";
import { RetailAnalyticsDashboard } from "@/components/retail/retail-analytics-dashboard";
import "@/app/intelligence/retail/retail-analytics.css";

const OPEN: DealerOrderStatus[] = STAGE_TILES.flatMap((t) => t.statuses);
/** "KES 18.4M" / "KES 950K" so the figure fits its card; the exact amount is the card's title. */
const kesShort = (n: number) => (n >= 1e6 ? `KES ${Math.round(n / 1e5) / 10}M` : n >= 1e3 ? `KES ${Math.round(n / 100) / 10}K` : `KES ${Math.round(n)}`);
const litresOf = (lines: { quantityLitres: number }[]) => lines.reduce((s, l) => s + l.quantityLitres, 0);

/** Staff Analytics, direction C (live dashboards spec §3.1): what needs Trinity now, then the month. */
export default async function RetailDashboardPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view")) redirect("/intelligence/dashboard");
  const now = new Date();
  const monthStart = nairobiMonthStart(now);

  const [open, events, year, dealers, cycleRows] = await Promise.all([
    prisma.dealerOrder.findMany({
      where: { status: { in: OPEN } },
      select: {
        id: true,
        reference: true,
        status: true,
        updatedAt: true,
        dealerOrganization: { select: { name: true } },
        history: { orderBy: { createdAt: "desc" }, take: 1, select: { toStatus: true, createdAt: true } },
      },
    }),
    prisma.orderStatusHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        toStatus: true,
        createdAt: true,
        order: { select: { reference: true, amountDue: true, dealerOrganization: { select: { name: true } }, depot: { select: { name: true } } } },
      },
    }),
    prisma.dealerOrder.findMany({
      where: { createdAt: { gte: nairobiMonthStart(now, -11) } },
      select: {
        id: true,
        createdAt: true,
        status: true,
        amountDue: true,
        dealerOrganizationId: true,
        dealerOrganization: { select: { name: true } },
        station: { select: { code: true } },
        lines: { select: { product: true, quantityLitres: true } },
      },
    }),
    prisma.dealerOrganization.findMany({
      select: { name: true, orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
    prisma.dealerOrder.findMany({
      where: { createdAt: { gte: monthStart } },
      select: {
        createdAt: true,
        quotedAt: true,
        deliveredAt: true,
        history: { where: { toStatus: { in: ["PAYMENT_CONFIRMED", "RELEASED_TO_DEPOT"] } }, select: { toStatus: true, createdAt: true } },
      },
    }),
  ]);

  const stuck = stuckOrders(
    open.map((o) => ({
      id: o.id,
      reference: o.reference,
      status: o.status,
      dealer: o.dealerOrganization.name,
      enteredAt: o.history[0]?.toStatus === o.status ? o.history[0].createdAt : null,
      updatedAt: o.updatedAt,
    })),
    now,
  );

  // 12 points per figure: the same monthFigures, asked about each month in turn.
  const monthRows = year.map((o) => ({ ...o, dealerId: o.dealerOrganizationId }));
  const series = Array.from({ length: 12 }, (_, i) => monthFigures(monthRows, nairobiMonthStart(now, i - 11)));
  const month = series[11];
  const kpis = [
    { label: "Litres this month", value: `${month.litres.toLocaleString("en-KE")} L`, delta: pctChange(month.litres, month.prev.litres), spark: series.map((s) => s.litres) },
    { label: "Value incl. VAT", value: kesShort(Number(month.value)), title: `KES ${Number(month.value).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`, delta: pctChange(Number(month.value), Number(month.prev.value)), spark: series.map((s) => Number(s.value)) },
    { label: "Orders", value: month.orders.toLocaleString("en-KE"), delta: pctChange(month.orders, month.prev.orders), spark: series.map((s) => s.orders) },
    { label: "Active dealers", value: `${month.activeDealers} of ${dealers.length}`, delta: pctChange(month.activeDealers, month.prev.activeDealers), spark: series.map((s) => s.activeDealers) },
  ];

  const thisMonth = year.filter((o) => o.createdAt >= monthStart && !["CANCELLED", "REJECTED", "DRAFT"].includes(o.status));
  const byDealer = new Map<string, number>();
  for (const o of thisMonth) byDealer.set(o.dealerOrganization.name, (byDealer.get(o.dealerOrganization.name) ?? 0) + litresOf(o.lines));

  const at = (rows: { toStatus: string; createdAt: Date }[], status: string) => rows.find((h) => h.toStatus === status)?.createdAt ?? null;

  return (
    <div className="ui-page">
      <PageHead
        title="Analytics"
        description="Right now at the top, this month underneath."
        action={<LiveRefresh channel={ORDERS_STAFF_CHANNEL} />}
      />
      <RetailAnalyticsDashboard
        tiles={stageCounts(open)}
        stuck={stuck.slice(0, 3).map((s) => ({ ...s, waitedMs: s.waitedMs }))}
        stuckCount={stuck.length}
        events={events.map((e) => ({
          id: e.id,
          at: e.createdAt.toISOString(),
          text: eventLine({ toStatus: e.toStatus, reference: e.order.reference, dealer: e.order.dealerOrganization.name, depot: e.order.depot?.name }),
          amount: ["PAYMENT_SUBMITTED", "AWAITING_PAYMENT", "PFI_ISSUED"].includes(e.toStatus) ? e.order.amountDue : null,
        }))}
        kpis={kpis}
        litres={monthlyLitres(year.map((o) => ({ ...o, lines: o.lines })), now, 12)}
        cycle={cycleMedians(
          cycleRows.map((r) => ({ createdAt: r.createdAt, quotedAt: r.quotedAt, paidAt: at(r.history, "PAYMENT_CONFIRMED"), releasedAt: at(r.history, "RELEASED_TO_DEPOT"), deliveredAt: r.deliveredAt })),
        )}
        regions={regionTotals(year.filter((o) => !["CANCELLED", "REJECTED", "DRAFT"].includes(o.status)).map((o) => ({ stationCode: o.station.code, litres: litresOf(o.lines), createdAt: o.createdAt })), now)}
        dealers={topDealers([...byDealer].map(([dealer, litres]) => ({ dealer, litres })))}
        quiet={goneQuiet(dealers.map((d) => ({ name: d.name, lastOrderAt: d.orders[0]?.createdAt ?? null })), now).slice(0, 5)}
        nowIso={now.toISOString()}
      />
    </div>
  );
}
