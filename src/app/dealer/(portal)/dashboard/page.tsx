import Link from "next/link";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nairobiGreeting, nairobiMonthStart } from "@/lib/time/nairobi";
import { formatKes, formatKesShort, sumKes } from "@/lib/orders/money";
import { orderEstimate } from "@/lib/orders/order-estimate";
import { formatWaited } from "@/lib/insights/order-flow";
import { onTheWay, toPay } from "@/lib/insights/business";
import { fulfillmentForStation } from "@/lib/integrations/odoo/quotation-contract";
import { priceListEndDate } from "@/lib/integrations/odoo/price-list-status";
import { unreadMessageCount } from "@/lib/messaging/service";
import { ordersDealerChannel } from "@/lib/pusher/server-channels";
import { dealerStatusLabel } from "@/lib/orders/state-machine";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import {
  dashboardSummary,
  monthlyLitres,
} from "@/lib/dealer/dashboard-summary";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/states";
import { PhotoHero } from "@/components/layout/photo-hero";
import { FuelChart } from "@/components/dealer/fuel-chart";
import { OrderTrackerMini } from "@/components/dealer/order-tracker-mini";
import { LiveRefresh } from "@/components/live/live-refresh";
import "./dashboard.css";

const litres = (n: number) => `${n.toLocaleString("en-KE")} L`;
const NOT_COUNTED = ["CANCELLED", "REJECTED", "DRAFT"];
const PFIS = "/dealer/orders?view=documents";
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** The dealer dashboard in the chosen E2 design (redesign spec §5). */
export default async function DealerDashboardPage() {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const userId = session.user.id;
  const now = new Date();
  const [org, orders, stations, messages, unread] = await Promise.all([
    prisma.dealerOrganization.findUnique({ where: { id: orgId } }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      include: {
        lines: true,
        depot: { select: { name: true } },
        history: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { toStatus: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.station.findMany({
      where: { dealerOrganizationId: orgId },
      orderBy: { name: "asc" },
    }),
    // The dealer's own conversations only; messages from Trinity staff.
    prisma.message.findMany({
      where: {
        deletedAt: null,
        sender: { accountType: "INTERNAL" },
        conversation: { participants: { some: { userId } } },
      },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        id: true,
        body: true,
        createdAt: true,
        sender: {
          select: { firstName: true, lastName: true, department: true },
        },
      },
    }),
    unreadMessageCount(userId),
  ]);
  const enteredAt = (o: (typeof orders)[number]) =>
    o.history[0]?.toStatus === o.status ? o.history[0].createdAt : o.updatedAt;

  // Odoo names are often in capitals; E2 greets in normal case.
  const company = (org?.name ?? "Dealer")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const place =
    stations.length === 1
      ? stations[0].name
      : stations.length > 1
        ? `${stations.length} stations`
        : company;
  const priced = stations.find(
    (s) => s.code && epraUnitPriceForStation(s.code, "PMS") != null,
  );
  const pms = priced?.code ? epraUnitPriceForStation(priced.code, "PMS") : null;
  const ago = priced?.code ? epraUnitPriceForStation(priced.code, "AGO") : null;
  const summary = dashboardSummary(orders);
  const pmsShare = summary.month.litres
    ? Math.round((summary.month.pmsLitres / summary.month.litres) * 100)
    : 0;
  const chart = monthlyLitres(orders);
  const due = toPay(
    orders.map((o) => ({
      status: o.status,
      amountDue: o.amountDue?.toString() ?? null,
      enteredAt: enteredAt(o),
    })),
    now,
  );
  const way = onTheWay(orders);
  const moving = orders.find((o) => o.id === way.current) ?? null;
  const monthValue = sumKes(
    orders
      .filter(
        (o) =>
          o.createdAt >= nairobiMonthStart(now) &&
          !NOT_COUNTED.includes(o.status),
      )
      .map((o) => o.amountDue?.toString() ?? null),
  );
  const tenK =
    pms != null && ago != null
      ? orderEstimate({ pms: 10000, ago: 0 }, { pms, ago })
      : null;
  const depotName = priced?.code
    ? fulfillmentForStation(priced.code)?.warehouseName
    : null;
  const ago_ = (d: Date) => formatWaited(now.getTime() - d.getTime());

  return (
    <div className="dd">
      <div className="dd-hero">
        <PhotoHero
          place={place}
          title={`${nairobiGreeting()}, ${company}`}
          sentence={summary.needsYou}
          actions={
            <>
              <Link
                href="/dealer/orders/new"
                className="ui-btn ui-btn--primary"
              >
                Place an order
              </Link>
              {summary.secondAction ? (
                <Link
                  href={summary.secondAction.href}
                  className="ui-btn photo-hero__light"
                >
                  {summary.secondAction.label}
                </Link>
              ) : null}
            </>
          }
        />
      </div>

      <div className="dd-below">
        <section className="dd-lift" aria-label="Your orders at a glance">
          <article className="dd-card">
            <span className="dd-card__label">To pay</span>
            <b className="dd-card__value" title={formatKes(due.total)}>
              {!due.count ? "Nothing to pay" : Number(due.total) > 0 ? formatKes(due.total) : `${due.count} ${due.count === 1 ? "PFI" : "PFIs"} to pay`}
            </b>
            <span className="dd-soft dd-small">
              {due.count
                ? `${due.count} ${due.count === 1 ? "PFI" : "PFIs"} · oldest waiting ${formatWaited(due.oldestMs ?? 0)}`
                : "Every PFI is paid"}
            </span>
            {due.count ? (
              <Link href={PFIS} className="ui-btn ui-btn--primary dd-card__btn">
                Pay PFI
              </Link>
            ) : null}
          </article>
          <article className="dd-card">
            <div className="dd-card__top">
              <span className="dd-card__label">On the way</span>
              <LiveRefresh channel={ordersDealerChannel(orgId)} />
            </div>
            {moving ? (
              <>
                <b className="dd-card__value">{moving.reference}</b>
                <span className="dd-soft dd-small">
                  {dealerStatusLabel(moving.status)}
                  {moving.depot ? ` · ${moving.depot.name}` : ""} ·{" "}
                  {moving.lines
                    .map((l) => `${litres(l.quantityLitres)} ${l.product}`)
                    .join(" + ")}
                </span>
                <span className="dd-soft dd-small">
                  In this step for {ago_(enteredAt(moving))}
                </span>
              </>
            ) : (
              <>
                <b className="dd-card__value">Nothing on the way</b>
                <span className="dd-soft dd-small">
                  Paid orders show here once they are released to a depot.
                </span>
              </>
            )}
          </article>
          <article className="dd-card">
            <span className="dd-card__label">This month</span>
            <b className="dd-card__value">{litres(summary.month.litres)}</b>
            <span className="dd-soft dd-small">
              {summary.month.orders}{" "}
              {summary.month.orders === 1 ? "order" : "orders"}
              {Number(monthValue) > 0 ? <span title={formatKes(monthValue)}> · {formatKesShort(monthValue)}</span> : null}
            </span>
            {summary.month.litres ? (
              <div
                className="dd-split"
                role="img"
                aria-label={`PMS ${pmsShare}%, AGO ${100 - pmsShare}%`}
              >
                {pmsShare > 0 ? (
                  <span className="is-pms" style={{ width: `${pmsShare}%` }}>
                    {pmsShare >= 15 ? `PMS ${pmsShare}%` : ""}
                  </span>
                ) : null}
                {pmsShare < 100 ? (
                  <span
                    className="is-ago"
                    style={{ width: `${100 - pmsShare}%` }}
                  >
                    {100 - pmsShare >= 15 ? `AGO ${100 - pmsShare}%` : ""}
                  </span>
                ) : null}
              </div>
            ) : null}
          </article>
        </section>

        {moving ? (
          <section className="ui-panel dd-where" aria-labelledby="dd-where">
            <div className="dd-head">
              <div>
                <h2 id="dd-where">{moving.reference} · where it is now</h2>
                <p className="dd-soft dd-small">
                  {[
                    moving.depot?.name,
                    moving.truckRegistration
                      ? `Truck ${moving.truckRegistration}`
                      : null,
                    moving.driverName ? `Driver ${moving.driverName}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "Truck and driver are confirmed by the depot"}
                </p>
              </div>
              {way.more ? (
                <Link
                  href="/dealer/orders?view=deliveries"
                  className="ui-navlink"
                >
                  + {way.more} more on the way
                </Link>
              ) : (
                <Link
                  href={`/dealer/orders/${moving.id}`}
                  className="ui-navlink"
                >
                  Open order
                </Link>
              )}
            </div>
            <OrderTrackerMini status={moving.status} />
          </section>
        ) : null}

        <div className="dd-top">
          <section className="ui-panel" aria-labelledby="dd-fuel">
            <div className="dd-head">
              <div>
                <h2 id="dd-fuel">Fuel ordered</h2>
                <p className="dd-soft dd-small">
                  Litres per month, last 6 months
                </p>
              </div>
              <div className="dd-legend" aria-hidden>
                <span>
                  <i className="is-pms" /> PMS
                </span>
                <span>
                  <i className="is-ago" /> AGO
                </span>
              </div>
            </div>
            <FuelChart months={chart} />
            <details className="dd-table">
              <summary>Show as a table</summary>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>PMS</th>
                    <th>AGO</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.map((m) => (
                    <tr key={m.label}>
                      <td>{m.label}</td>
                      <td>{litres(m.pms)}</td>
                      <td>{litres(m.ago)}</td>
                      <td>{litres(m.pms + m.ago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <section aria-labelledby="dd-prices" className="ui-panel dd-prices">
            <h2 id="dd-prices">Today&apos;s prices</h2>
            {pms != null && ago != null ? (
              <>
                <p className="dd-soft dd-small">
                  {priced?.name}
                  {depotName ? ` (${depotName})` : ""} · EPRA list valid to{" "}
                  {dayLabel(priceListEndDate())}
                </p>
                <dl>
                  <div>
                    <dt>PMS per litre</dt>
                    <dd>KSh {pms.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>AGO per litre</dt>
                    <dd>KSh {ago.toFixed(2)}</dd>
                  </div>
                </dl>
                {tenK ? (
                  <p className="dd-prices__tenk">
                    10,000 L PMS today ≈ <b>{formatKes(tenK.total)}</b>{" "}
                    <span className="dd-soft dd-small">
                      incl. {Math.round(Number(tenK.vatRate) * 100)}% VAT
                    </span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="dd-soft">
                Prices show here once your station is set up for ordering.
              </p>
            )}
          </section>
        </div>

        <div className="dd-bottom">
          <section aria-labelledby="dd-orders">
            <div className="dd-head">
              <h2 id="dd-orders">Orders</h2>
              <Link href="/dealer/orders" className="ui-navlink">
                See all
              </Link>
            </div>
            {orders.length === 0 ? (
              <EmptyState
                title="No orders yet. Place your first order and we'll prepare the quotation and PFI for you."
                action={
                  <Link
                    href="/dealer/orders/new"
                    className="ui-btn ui-btn--primary"
                  >
                    Place an order
                  </Link>
                }
              />
            ) : (
              <ul className="dd-list">
                {orders.slice(0, 3).map((o) => (
                  <li key={o.id}>
                    <Link href={`/dealer/orders/${o.id}`} className="dd-row">
                      <b>{o.reference}</b>
                      <span className="dd-row__fuel">
                        {o.lines
                          .map(
                            (l) => `${l.product} ${litres(l.quantityLitres)}`,
                          )
                          .join(" · ")}
                      </span>
                      <span className="dd-row__amount">
                        {o.amountDue ? formatKes(o.amountDue.toString()) : "—"}
                      </span>
                      <StatusChip
                        status={o.status}
                        label={dealerStatusLabel(o.status)}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="dd-msgs" className="ui-panel dd-msgs">
            <div className="dd-head">
              <h2 id="dd-msgs">Messages</h2>
              <Link href="/dealer/messaging" className="ui-navlink">
                {unread ? `${unread} unread` : "Open"}
              </Link>
            </div>
            {messages.length === 0 ? (
              <p className="dd-soft">No messages from Trinity yet.</p>
            ) : (
              <ul>
                {messages.map((m) => (
                  <li key={m.id}>
                    <Link href="/dealer/messaging">
                      <span className="dd-msgs__av" aria-hidden>
                        {(m.sender.firstName[0] ?? "") +
                          (m.sender.lastName[0] ?? "")}
                      </span>
                      <span className="dd-msgs__text">
                        <b>
                          {m.sender.firstName}, Trinity {m.sender.department}
                        </b>
                        <span>{m.body}</span>
                      </span>
                      <em>{ago_(m.createdAt)} ago</em>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
