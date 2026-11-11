import Link from "next/link";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/permissions";
import { requireInternal } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatStockReportDate } from "@/lib/stock-reporting/dates";
import {
  defaultStaffReportDate,
  formatSignedLitres,
  parseIsoDateParam,
  resolvePeriodBounds,
  toIsoDateParam,
  type StaffReportingPeriod,
} from "@/lib/stock-reporting/staff-reconciliation";
import "@/app/intelligence/retail/staff-stock-reporting.css";

export const dynamic = "force-dynamic";

type Search = {
  station?: string;
  period?: string;
  date?: string;
  from?: string;
  to?: string;
};

function parsePeriod(raw: string | undefined): StaffReportingPeriod {
  if (raw === "week" || raw === "month" || raw === "year" || raw === "custom" || raw === "day") {
    return raw;
  }
  return "day";
}

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function StaffShiftReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireInternal();
  if (!canUser(session.user, "analytics", "view") && !canUser(session.user, "orders", "view")) {
    redirect("/intelligence/retail");
  }

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const date = parseIsoDateParam(params.date) ?? defaultStaffReportDate();
  const from = parseIsoDateParam(params.from) ?? date;
  const to = parseIsoDateParam(params.to) ?? date;
  const bounds = resolvePeriodBounds({ period, date, from, to });

  const stations = await prisma.station.findMany({
    select: { id: true, name: true, tradingName: true },
    orderBy: [{ tradingName: "asc" }, { name: "asc" }],
  });
  const stationId = stations.find((s) => s.id === params.station)?.id ?? stations[0]?.id;
  if (!stationId) {
    return (
      <div className="ssr">
        <div className="ssr-wrap ssr-placeholder">No stations available.</div>
      </div>
    );
  }

  const station = stations.find((s) => s.id === stationId)!;
  const stationName = station.tradingName || station.name;

  const reports = await prisma.stockSaleReport.findMany({
    where: {
      stationId,
      reportingDate: { gte: bounds.start, lt: bounds.endExclusive },
    },
    include: {
      dealerOrganization: { select: { name: true } },
    },
    orderBy: [{ reportingDate: "desc" }, { updatedAt: "desc" }],
  });

  const backQs = qs({
    station: stationId,
    period,
    date: toIsoDateParam(date),
    from: period === "custom" ? toIsoDateParam(from) : undefined,
    to: period === "custom" ? toIsoDateParam(to) : undefined,
    section: "reconciliation",
  });

  return (
    <div className="ssr">
      <div className="ssr-wrap ssr-shifts">
        <header className="ssr-main" style={{ marginBottom: "0.85rem" }}>
          <div className="ssr-main__top">
            <div>
              <div className="ssr-main__title-row">
                <h1 className="ssr-main__title">Shift Reports — {stationName}</h1>
              </div>
              <p className="ssr-main__sub">
                Dealer stock sale reports for {bounds.label}. One CLOSED report is expected per
                Nairobi calendar day (multi-shift days are not modelled yet).
              </p>
            </div>
            <div className="ssr-actions">
              <Link className="ssr-btn ssr-btn--outline" href={`/intelligence/retail/stock-reporting${backQs}`}>
                ← Back to Reconciliation
              </Link>
            </div>
          </div>
        </header>

        <div className="ssr-main">
          {reports.length === 0 ? (
            <p className="ssr-placeholder">No stock reports for this station and period.</p>
          ) : (
            <div className="ssr-table-wrap">
              <table className="ssr-table">
                <thead>
                  <tr>
                    <th>Reporting date</th>
                    <th>Reference</th>
                    <th>Dealer</th>
                    <th>Status</th>
                    <th className="num">PMS sales (L)</th>
                    <th className="num">AGO sales (L)</th>
                    <th className="num">PMS variance (L)</th>
                    <th className="num">AGO variance (L)</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{formatStockReportDate(r.reportingDate)}</td>
                      <td>{r.reportReference || r.id.slice(0, 10)}</td>
                      <td>{r.dealerOrganization.name}</td>
                      <td>
                        <span
                          className={`ssr-status ${
                            r.status === "CLOSED" ? "ssr-status--complete" : "ssr-status--pending"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="num">
                        {(r.meterSalesPmsLitres ?? 0).toLocaleString("en-US")}
                      </td>
                      <td className="num">
                        {(r.meterSalesAgoLitres ?? 0).toLocaleString("en-US")}
                      </td>
                      <td className="num">
                        {formatSignedLitres(r.wetVariancePmsLitres ?? 0)}
                      </td>
                      <td className="num">
                        {formatSignedLitres(r.wetVarianceAgoLitres ?? 0)}
                      </td>
                      <td>
                        {(r.updatedAt ?? r.closedAt)?.toLocaleString("en-GB", {
                          timeZone: "Africa/Nairobi",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section id="explanations" style={{ marginTop: "1.1rem" }}>
            <h2 className="ssr-table-caption">Variance explanations</h2>
            {reports.filter((r) => r.wetLossReason?.trim()).length === 0 ? (
              <p className="ssr-empty-inline">
                No dealer variance explanations recorded for this period.
              </p>
            ) : (
              <ul className="ssr-station-list" style={{ maxHeight: "none" }}>
                {reports
                  .filter((r) => r.wetLossReason?.trim())
                  .map((r) => (
                    <li key={r.id} className="ssr-insight" style={{ border: "1px solid #e8eef5", borderRadius: 12, marginBottom: 8 }}>
                      <div>
                        <strong>
                          {formatStockReportDate(r.reportingDate)} · {r.reportReference || r.id.slice(0, 8)}
                        </strong>
                        <div style={{ marginTop: 4 }}>{r.wetLossReason}</div>
                      </div>
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
