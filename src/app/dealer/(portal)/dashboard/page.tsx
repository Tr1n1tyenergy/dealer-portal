import Link from "next/link";
import { requireDealer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nairobiGreeting } from "@/lib/time/nairobi";
import { formatKes } from "@/lib/orders/money";
import { dealerStatusLabel } from "@/lib/orders/state-machine";
import { epraUnitPriceForStation } from "@/lib/integrations/odoo/epra-temp-prices";
import { dashboardSummary, monthlyLitres } from "@/lib/dealer/dashboard-summary";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/states";
import { PhotoHero } from "@/components/layout/photo-hero";
import { FuelChart } from "@/components/dealer/fuel-chart";
import "./dashboard.css";

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
  const chart = monthlyLitres(orders);

  return (
    <div className="dd">
      <PhotoHero
        place={place}
        title={`${nairobiGreeting()}, ${company}`}
        sentence={`${summary.needsYou}${prices}`}
        actions={
          <>
            <Link href="/dealer/orders/new" className="ui-btn ui-btn--primary">
              Place an order
            </Link>
            {summary.secondAction ? (
              <Link href={summary.secondAction.href} className="ui-btn photo-hero__light">
                {summary.secondAction.label}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="dd-below">
        <div className="dd-top">
          <section className="ui-panel" aria-labelledby="dd-fuel">
            <div className="dd-head">
              <div>
                <h2 id="dd-fuel">Fuel ordered</h2>
                <p className="dd-soft dd-small">Litres per month, last 6 months</p>
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

          <section aria-labelledby="dd-month" className="ui-panel dd-month">
            <h2 id="dd-month">This month</h2>
            <div className="dd-month__litres">{litres(summary.month.litres)}</div>
            <span className="dd-soft">
              across {summary.month.orders} {summary.month.orders === 1 ? "order" : "orders"}
            </span>
            {summary.month.litres ? (
              <>
                <div className="dd-split" role="img" aria-label={`PMS ${pmsShare}%, AGO ${100 - pmsShare}%`}>
                  {pmsShare > 0 ? <span className="is-pms" style={{ width: `${pmsShare}%` }}>{pmsShare >= 15 ? `PMS ${pmsShare}%` : ""}</span> : null}
                  {pmsShare < 100 ? <span className="is-ago" style={{ width: `${100 - pmsShare}%` }}>{100 - pmsShare >= 15 ? `${100 - pmsShare}%` : ""}</span> : null}
                </div>
                <span className="dd-soft dd-small">
                  PMS {litres(summary.month.pmsLitres)} · AGO {litres(summary.month.agoLitres)}
                </span>
              </>
            ) : null}
          </section>
        </div>

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
      </div>
    </div>
  );
}
