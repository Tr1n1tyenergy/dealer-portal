import Link from "next/link";
import type { DealerOrderStatus } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { headerLinks } from "@/lib/ui/header-links";
import { nairobiGreeting, nairobiMonthStart } from "@/lib/time/nairobi";
import { formatKes, sumKes } from "@/lib/orders/money";
import { statusLabel } from "@/lib/orders/stages";
import { NEEDS_ACTION, staffHomeSummary } from "@/lib/staff/home-summary";
import { AppShell } from "@/components/layout/app-shell";
import { PhotoHero } from "@/components/layout/photo-hero";
import { OrderActions } from "@/components/retail/order-actions";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/states";
import "./staff-home.css";

const NOT_COUNTED: DealerOrderStatus[] = ["CANCELLED", "REJECTED", "DRAFT"];

/** Staff home (redesign spec §5): what waits on Trinity, the orders needing action, and this month. */
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

  const mayAct = canUser(user, "orders", "act");
  const [grouped, needsAction, month, depots] = await Promise.all([
    prisma.dealerOrder.groupBy({ by: ["status"], where: { status: { in: NEEDS_ACTION } }, _count: { _all: true } }),
    prisma.dealerOrder.findMany({
      where: { status: { in: NEEDS_ACTION } },
      include: { dealerOrganization: { select: { name: true } }, station: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
    prisma.dealerOrder.findMany({
      where: { createdAt: { gte: nairobiMonthStart() }, status: { notIn: NOT_COUNTED } },
      select: { amountDue: true, lines: { select: { quantityLitres: true } } },
    }),
    mayAct ? prisma.depot.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  const summary = staffHomeSummary(Object.fromEntries(grouped.map((g) => [g.status, g._count._all])));
  const litres = month.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + l.quantityLitres, 0), 0);

  return (
    <AppShell fullBleed>
      <PhotoHero
        title={title}
        sentence={summary.sentence}
        actions={summary.actions.map((a, i) => (
          <Link key={a.href} href={a.href} className={`ui-btn ${i === 0 ? "ui-btn--primary" : "photo-hero__light"}`}>
            {a.label}
          </Link>
        ))}
      />
      <div className="ui-page sh">
        <section aria-labelledby="sh-needs">
          <div className="sh-head">
            <h2 id="sh-needs" className="ui-section-title">
              Needs action
            </h2>
            <Link href="/intelligence/retail/orders?stage=all" className="ui-navlink">
              See all orders
            </Link>
          </div>
          {needsAction.length === 0 ? (
            <EmptyState title="Nothing needs action right now." />
          ) : (
            <ul className="sh-list">
              {needsAction.map((o) => (
                <li key={o.id} className="sh-row">
                  <span className="sh-row__ref">
                    <b>{o.reference}</b>
                    <span>
                      {o.dealerOrganization.name} · {o.station.name}
                    </span>
                  </span>
                  <span className="sh-row__amount">{formatKes(o.amountDue)}</span>
                  <StatusChip status={o.status} label={statusLabel(o.status)} />
                  <span className="sh-row__act">
                    <OrderActions orderId={o.id} status={o.status} depots={depots} mayAct={mayAct} />
                  </span>
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
    </AppShell>
  );
}
