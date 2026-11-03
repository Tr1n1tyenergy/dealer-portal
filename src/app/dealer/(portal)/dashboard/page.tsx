import Link from "next/link";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nairobiParts } from "@/lib/time/nairobi";
import { formatKes } from "@/lib/orders/money";
import { dealerStatusLabel } from "@/lib/orders/state-machine";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { dashboardSummary } from "@/lib/dealer/dashboard-summary";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/states";
import "./dashboard.css";

function greeting() {
  const { hour } = nairobiParts();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const litres = (n: number) => `${n.toLocaleString("en-KE")} L`;

/** The dealer dashboard in the chosen E2 design (redesign spec §5). */
export default async function DealerDashboardPage() {
  const session = await requireDealer();
  const orgId = session.user.dealerOrganizationId!;
  const [org, orders, stations] = await Promise.all([
    prisma.dealerOrganization.findUnique({ where: { id: orgId } }),
    prisma.dealerOrder.findMany({
      where: { dealerOrganizationId: orgId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.station.findMany({ where: { dealerOrganizationId: orgId }, orderBy: { name: "asc" } }),
  ]);

  // Odoo names are often in capitals; E2 greets in normal case.
  const company = (org?.name ?? "Dealer").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const place = stations.length === 1 ? stations[0].name : stations.length > 1 ? `${stations.length} stations` : company;
  const priced = stations.find((s) => s.code && epraUnitPriceForStation(s.code, "PMS") != null);
  const pms = priced?.code ? epraUnitPriceForStation(priced.code, "PMS") : null;
  const ago = priced?.code ? epraUnitPriceForStation(priced.code, "AGO") : null;
  const prices = pms != null && ago != null ? ` Today: PMS KSh ${pms.toFixed(2)} · AGO KSh ${ago.toFixed(2)}.` : "";
  const summary = dashboardSummary(orders);
  const pmsShare = summary.month.litres ? Math.round((summary.month.pmsLitres / summary.month.litres) * 100) : 0;

  return (
    <div className="dd">
      <section className="dd-hero">
        <div className="dd-hero__text">
          <span className="dd-hero__place">{place}</span>
          <h1>
            {greeting()}, {company}
          </h1>
          <p>
            {summary.needsYou}
            {prices}
          </p>
        </div>
        <div className="dd-hero__actions">
          <Link href="/dealer/orders/new" className="ui-btn ui-btn--primary">
            Place an order
          </Link>
          {summary.secondAction ? (
            <Link href={summary.secondAction.href} className="ui-btn dd-btn-light">
              {summary.secondAction.label}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="dd-below">
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
                <Link href="/dealer/orders/new" className="ui-btn ui-btn--primary">
                  Place an order
                </Link>
              }
            />
          ) : (
            <ul className="dd-list">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <Link href={`/dealer/orders/${o.id}`} className="dd-row">
                    <b>{o.reference}</b>
                    <span className="dd-row__fuel">
                      {o.lines.map((l) => `${l.product} ${litres(l.quantityLitres)}`).join(" · ")}
                    </span>
                    <span className="dd-row__amount">{o.amountDue ? formatKes(o.amountDue.toString()) : "—"}</span>
                    <StatusChip status={o.status} label={dealerStatusLabel(o.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dd-month" className="dd-month">
          <h2 id="dd-month">This month</h2>
          <div className="dd-month__litres">{litres(summary.month.litres)}</div>
          <span className="dd-soft">
            across {summary.month.orders} {summary.month.orders === 1 ? "order" : "orders"}
          </span>
          <div className="dd-bar" aria-hidden>
            <i style={{ width: `${pmsShare}%` }} />
          </div>
          <span className="dd-soft dd-small">
            PMS {pmsShare}% · AGO {summary.month.litres ? 100 - pmsShare : 0}%
          </span>
        </section>
      </div>
    </div>
  );
}
