import Link from "next/link";
import type { DealerOrderStatus } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { headerLinks } from "@/lib/ui/header-links";
import { nairobiGreeting, nairobiMonthStart } from "@/lib/time/nairobi";
import { formatKes, formatKesShort, sumKes } from "@/lib/orders/money";
import { statusLabel } from "@/lib/orders/stages";
import { formatWaited, waitedOn } from "@/lib/insights/order-flow";
import { dealersWaiting, depotsToday, todayFigures } from "@/lib/insights/business";
import { EPRA_TEMP_PRICES_BY_WAREHOUSE } from "@/lib/integrations/odoo/epra-temp-prices";
import { priceListDays, priceListEndDate, priceListStatus } from "@/lib/integrations/odoo/price-list-status";
import { recentEvents } from "@/lib/live/recent-events";
import { ORDERS_STAFF_CHANNEL } from "@/lib/pusher/server-channels";
import { NEEDS_ACTION, staffHomeSummary } from "@/lib/staff/home-summary";
import { AppShell } from "@/components/layout/app-shell";
import { PhotoHero } from "@/components/layout/photo-hero";
import { HappeningNow } from "@/components/live/happening-now";
import { LiveRefresh } from "@/components/live/live-refresh";
import { OrderActions } from "@/components/retail/order-actions";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/states";
import "./staff-home.css";

const NOT_COUNTED: DealerOrderStatus[] = ["CANCELLED", "REJECTED", "DRAFT"];
const DAY = 86400e3;
const litresOf = (lines: { quantityLitres: number }[]) => lines.reduce((s, l) => s + l.quantityLitres, 0);
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Staff home (live dashboards spec §3.2): today in four numbers, what needs action, what is happening, the month. */
export default async function StaffHomePage() {
  const session = await requireSession();
  const user = session.user;
  const title = `${nairobiGreeting()}, ${user.firstName || "there"}`;

  if (!canUser(user, "orders", "view")) {
    const hasOther = headerLinks("staff", user).length > 1;
    return (
      <AppShell fullBleed>
        <PhotoHero
          title={title}
          sentence={hasOther ? "Your areas are in the menu above." : "Ask an Admin for access."}
        />
      </AppShell>
    );
  }

  const now = new Date();
  const since = new Date(now.getTime() - 2 * DAY); // covers today and yesterday in Nairobi time
  const mayAct = canUser(user, "orders", "act");
  const seesMessages = canUser(user, "messaging", "view");
  const [grouped, needsAction, month, depots, recent, confirmations, dispatches, loading, threads, events] = await Promise.all([
    prisma.dealerOrder.groupBy({ by: ["status"], where: { status: { in: NEEDS_ACTION } }, _count: { _all: true } }),
    prisma.dealerOrder.findMany({
      where: { status: { in: NEEDS_ACTION } },
      include: {
        dealerOrganization: { select: { name: true } },
        station: { select: { name: true } },
        history: { orderBy: { createdAt: "desc" }, take: 1, select: { toStatus: true, createdAt: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
    prisma.dealerOrder.findMany({
      where: { createdAt: { gte: nairobiMonthStart(now) }, status: { notIn: NOT_COUNTED } },
      select: { amountDue: true, lines: { select: { quantityLitres: true } } },
    }),
    prisma.depot.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.dealerOrder.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true, lines: { select: { quantityLitres: true } } } }),
    prisma.orderStatusHistory.findMany({
      where: { toStatus: "PAYMENT_CONFIRMED", createdAt: { gte: since } },
      select: { createdAt: true, order: { select: { amountDue: true } } },
    }),
    prisma.orderStatusHistory.findMany({
      where: { toStatus: "DISPATCHED", createdAt: { gte: since } },
      select: { createdAt: true, order: { select: { depot: { select: { name: true } }, lines: { select: { quantityLitres: true } } } } },
    }),
    prisma.dealerOrder.findMany({ where: { status: { in: ["LOADING", "LOADED"] } }, select: { depot: { select: { name: true } } } }),
    seesMessages
      ? // shortcut: only threads active in the last 30 days, enough for "waiting for a reply"; widen if replies routinely take longer
        prisma.conversation.findMany({
          where: { lastMessageAt: { gte: new Date(now.getTime() - 30 * DAY) }, participants: { some: { user: { accountType: "DEALER" } } } },
          select: {
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, sender: { select: { accountType: true, dealerOrganization: { select: { name: true } } } } },
            },
          },
        })
      : Promise.resolve([]),
    recentEvents(),
  ]);

  const summary = staffHomeSummary(Object.fromEntries(grouped.map((g) => [g.status, g._count._all])));
  const litres = month.reduce((sum, o) => sum + litresOf(o.lines), 0);
  const today = todayFigures(
    {
      orders: recent.map((o) => ({ createdAt: o.createdAt, status: o.status, litres: litresOf(o.lines) })),
      confirmations: confirmations.map((c) => ({ at: c.createdAt, amount: c.order.amountDue })),
      dispatches: dispatches.map((d) => ({ at: d.createdAt, litres: litresOf(d.order.lines) })),
    },
    now,
  );
  const depotRows = depotsToday(
    depots.map((d) => d.name),
    loading.flatMap((o) => (o.depot ? [{ depot: o.depot.name }] : [])),
    dispatches.flatMap((d) => (d.order.depot ? [{ depot: d.order.depot.name, at: d.createdAt }] : [])),
    now,
  );
  const dispatchedFrom = depotRows.filter((d) => d.dispatched > 0).map((d) => d.depot);
  const trucks = depotRows.reduce((s, d) => s + d.dispatched, 0);
  const waiting = dealersWaiting(
    threads.flatMap((t) => {
      const last = t.messages[0];
      if (!last) return [];
      return [{ lastAt: last.createdAt, dealer: last.sender.accountType === "DEALER" ? (last.sender.dealerOrganization?.name ?? "A dealer") : null }];
    }),
    now,
  );
  const listEnd = priceListEndDate();
  const listStart = Object.values(EPRA_TEMP_PRICES_BY_WAREHOUSE).find((r) => r.periodTo === listEnd)?.periodFrom ?? listEnd;
  const listDays = priceListDays(now, listStart, listEnd);
  const listStatus = priceListStatus(now);
  const ordersDelta = today.newOrders - today.newOrdersYesterday;

  return (
    <AppShell fullBleed>
      <div className="sh-hero">
        <PhotoHero
          title={title}
          sentence={summary.sentence}
          actions={summary.actions.map((a, i) => (
            <Link key={a.href} href={a.href} className={`ui-btn ${i === 0 ? "ui-btn--primary" : "photo-hero__light"}`}>
              {a.label}
            </Link>
          ))}
        />
      </div>
      <div className="ui-page sh">
        <section className={`sh-today${seesMessages ? "" : " sh-today--three"}`} aria-label="Today">
          <article className="sh-tile">
            <span className="sh-tile__label">New orders today</span>
            <b className="sh-tile__value">{today.newOrders}</b>
            <span className="sh-tile__sub">
              {ordersDelta === 0 ? "Same as yesterday" : `${ordersDelta > 0 ? "↑" : "↓"} ${Math.abs(ordersDelta)} vs yesterday`} · {today.litresOrdered.toLocaleString("en-KE")} L
            </span>
          </article>
          <article className="sh-tile">
            <span className="sh-tile__label">Payments confirmed today</span>
            <b className="sh-tile__value" title={formatKes(today.paymentsValue)}>
              {formatKesShort(today.paymentsValue)}
            </b>
            <span className="sh-tile__sub">
              {today.paymentsConfirmed} {today.paymentsConfirmed === 1 ? "payment" : "payments"}
            </span>
          </article>
          <article className="sh-tile">
            <span className="sh-tile__label">Dispatched today</span>
            <b className="sh-tile__value">{today.litresDispatched.toLocaleString("en-KE")} L</b>
            <span className="sh-tile__sub">
              {trucks === 0 ? "No trucks out yet" : `${trucks} ${trucks === 1 ? "truck" : "trucks"} · ${dispatchedFrom.join(", ")}`}
            </span>
          </article>
          {seesMessages ? (
            <Link href="/intelligence/retail/messaging" className="sh-tile sh-tile--link">
              <span className="sh-tile__label">Dealers waiting for a reply</span>
              <b className="sh-tile__value">{waiting.count}</b>
              <span className="sh-tile__sub">{waiting.count === 0 ? "Everyone has a reply" : `longest ${formatWaited(waiting.longestMs)} · ${waiting.dealer}`}</span>
            </Link>
          ) : null}
        </section>

        <div className="sh-main">
          <section aria-labelledby="sh-needs">
            <div className="sh-head">
              <div>
                <h2 id="sh-needs" className="ui-section-title">
                  Needs action
                </h2>
                <p className="sh-sub">Oldest first · red is past its stage&apos;s time limit</p>
              </div>
              <Link href="/intelligence/retail/orders?stage=all" className="ui-navlink">
                See all orders
              </Link>
            </div>
            {needsAction.length === 0 ? (
              <EmptyState title="Nothing needs action right now." />
            ) : (
              <ul className="sh-list">
                {needsAction.map((o) => {
                  const w = waitedOn({ status: o.status, enteredAt: o.history[0]?.toStatus === o.status ? o.history[0].createdAt : null, updatedAt: o.updatedAt }, now);
                  return (
                    <li key={o.id} className="sh-row">
                      <span className="sh-row__ref">
                        <b>{o.reference}</b>
                        <span>
                          {o.dealerOrganization.name} · {o.station.name}
                        </span>
                      </span>
                      <span className="sh-row__amount">{formatKes(o.amountDue)}</span>
                      <span className="sh-row__chips">
                        <StatusChip status={o.status} label={statusLabel(o.status)} />
                        <span className={`ui-chip ${w.over ? "ui-chip--problem" : "ui-chip--muted"}`}>Waiting {formatWaited(w.waitedMs)}</span>
                      </span>
                      <span className="sh-row__act">
                        <OrderActions orderId={o.id} status={o.status} depots={mayAct ? depots : []} mayAct={mayAct} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="sh-now" className="ui-panel sh-now">
            <div className="sh-head">
              <h2 id="sh-now" className="ui-section-title">
                Happening now
              </h2>
              <LiveRefresh channel={ORDERS_STAFF_CHANNEL} />
            </div>
            <HappeningNow events={events} nowIso={now.toISOString()} />
          </section>
        </div>

        <div className="sh-row3">
          <section aria-labelledby="sh-epra" className={`ui-panel sh-epra${listStatus.state === "current" ? "" : " is-ending"}`}>
            <h2 id="sh-epra" className="ui-section-title">
              EPRA price list
            </h2>
            <p className="sh-sub">Used for every quotation</p>
            <b className="sh-epra__to">Valid to {dayLabel(listEnd)}</b>
            <span className="sh-meter" aria-hidden>
              <span style={{ width: `${(listDays.left / listDays.total) * 100}%` }} />
            </span>
            <p className="sh-epra__left">{listStatus.message ?? `${listDays.left} of ${listDays.total} days left · new list on the 15th`}</p>
          </section>

          <section aria-labelledby="sh-depots" className="ui-panel sh-depots">
            <h2 id="sh-depots" className="ui-section-title">
              Depots today
            </h2>
            {depotRows.length === 0 ? (
              <p className="sh-sub">No depots set up yet.</p>
            ) : (
              <ul>
                {depotRows.map((d) => (
                  <li key={d.depot}>
                    <span>{d.depot}</span>
                    <em className={d.loading || d.dispatched ? undefined : "is-idle"}>
                      {d.loading || d.dispatched ? [d.loading ? `${d.loading} loading` : "", d.dispatched ? `${d.dispatched} dispatched` : ""].filter(Boolean).join(" · ") : "Idle"}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="sh-month" className="ui-panel sh-month">
            <h2 id="sh-month" className="ui-section-title">
              This month
            </h2>
            <dl>
              <div>
                <dt>Orders</dt>
                <dd>{month.length.toLocaleString("en-KE")}</dd>
              </div>
              <div>
                <dt>Litres</dt>
                <dd>{litres.toLocaleString("en-KE")} L</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>{formatKes(sumKes(month.map((o) => o.amountDue)))}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
