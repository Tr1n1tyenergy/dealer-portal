import Link from "next/link";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatKes, nairobiYesterdayStart, thisMonthBounds } from "@/lib/retail/staff-home";
import "@/app/intelligence/retail/staff-home.css";

export default async function StaffStockReportingPage() {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view") && !canUser(session.user, "orders", "view")) {
    redirect("/intelligence/retail");
  }

  const now = new Date();
  const yesterday = nairobiYesterdayStart(now);
  const { start: monthStart, end: monthEnd } = thisMonthBounds(now);

  const [stations, closedYesterday, monthClosed] = await Promise.all([
    prisma.station.findMany({
      select: {
        id: true,
        name: true,
        tradingName: true,
        dealerOrganization: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockSaleReport.findMany({
      where: { reportingDate: yesterday, status: "CLOSED" },
      select: { stationId: true },
    }),
    prisma.stockSaleReport.findMany({
      where: {
        status: "CLOSED",
        reportingDate: { gte: monthStart, lt: monthEnd },
      },
      include: {
        station: { select: { name: true, tradingName: true } },
        dealerOrganization: { select: { name: true } },
      },
      orderBy: { closedAt: "desc" },
      take: 40,
    }),
  ]);

  const closedIds = new Set(closedYesterday.map((r) => r.stationId));
  const missing = stations.filter((s) => !closedIds.has(s.id));

  return (
    <div className="sh" style={{ paddingTop: "1.5rem" }}>
      <div className="sh-wrap">
        <header className="sh-panel" style={{ marginBottom: "1rem" }}>
          <div className="sh-panel__head" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div>
              <h1 className="sh-panel__title">Stock Sale Reporting</h1>
              <p className="sh-panel__sub">
                Live submission status across dealer stations (Africa/Nairobi calendar).
              </p>
            </div>
            <Link href="/intelligence/retail" className="sh-panel__link">
              ← Back to Home
            </Link>
          </div>
        </header>

        <div className="sh-ops">
          <article className="sh-panel">
            <header className="sh-panel__head">
              <div>
                <h2 className="sh-panel__title">Missing yesterday</h2>
                <p className="sh-panel__sub">
                  Stations without a CLOSED report for yesterday.
                </p>
              </div>
              <span className="sh-badge sh-badge--overdue">{missing.length}</span>
            </header>
            {missing.length === 0 ? (
              <p className="sh-empty">All stations submitted yesterday’s report.</p>
            ) : (
              <ul className="sh-feed">
                {missing.map((s) => (
                  <li key={s.id}>
                    <div className="sh-feed__item" style={{ gridTemplateColumns: "1fr" }}>
                      <p className="sh-feed__text">
                        {s.tradingName || s.name}
                        <span className="sh-kpi__meta"> — {s.dealerOrganization.name}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="sh-panel">
            <header className="sh-panel__head">
              <div>
                <h2 className="sh-panel__title">Closed this month</h2>
                <p className="sh-panel__sub">Most recent CLOSED stock sale reports.</p>
              </div>
              <span className="sh-badge sh-badge--due">{monthClosed.length}</span>
            </header>
            {monthClosed.length === 0 ? (
              <p className="sh-empty">No CLOSED stock sale reports this month yet.</p>
            ) : (
              <ul className="sh-feed">
                {monthClosed.map((r) => {
                  const collections = Number(r.collectionsKes ?? 0);
                  return (
                    <li key={r.id}>
                      <div className="sh-feed__item" style={{ gridTemplateColumns: "1fr auto" }}>
                        <div>
                          <p className="sh-feed__text">
                            {r.reportReference || r.id.slice(0, 8)} —{" "}
                            {r.station.tradingName || r.station.name}
                          </p>
                          <p className="sh-kpi__meta" style={{ marginTop: 4 }}>
                            {r.dealerOrganization.name}
                            {Number.isFinite(collections) && collections > 0
                              ? ` · ${formatKes(collections)}`
                              : ""}
                          </p>
                        </div>
                        <span className="sh-feed__time">
                          {r.reportingDate.toLocaleDateString("en-GB", {
                            timeZone: "Africa/Nairobi",
                          })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
