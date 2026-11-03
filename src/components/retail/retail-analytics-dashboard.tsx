import Link from "next/link";
import type { DealerOrderStatus } from "@prisma/client";
import { type AnalyticsStatusBucket, sparklinePath } from "@/lib/retail/analytics";
import { StatusChip } from "@/components/ui/status-chip";

export type RetailKpi = {
  label: string;
  value: number;
  deltaPct: number;
  /** Only real monthly series; KPIs without one show no trend line. */
  spark?: number[];
};

export type TrendPoint = { label: string; pms: number; ago: number };

export type StatusSlice = { bucket: AnalyticsStatusBucket; count: number; pct: number };

export type RecentOrderRow = {
  id: string;
  reference: string;
  dealer: string;
  station: string;
  products: string;
  volume: string;
  status: string;
  orderStatus: DealerOrderStatus;
  created: string;
};

export type StationVolumeRow = {
  name: string;
  litres: number;
  pct: number;
};

/** Retail analytics in the E2 style (redesign spec §6): real figures only, brand colours, every chart also as a table. */
export function RetailAnalyticsDashboard({
  kpis,
  trend,
  statusSlices,
  totalOrders,
  recentOrders,
  topStations,
}: {
  kpis: RetailKpi[];
  trend: TrendPoint[];
  statusSlices: StatusSlice[];
  totalOrders: number;
  recentOrders: RecentOrderRow[];
  topStations: StationVolumeRow[];
}) {
  const otherOrders = totalOrders - statusSlices.reduce((sum, s) => sum + s.count, 0);
  const statusRows = [
    ...statusSlices.map((s) => ({ name: s.bucket, count: s.count, pct: s.pct, other: false })),
    ...(otherOrders > 0
      ? [{ name: "Cancelled or other", count: otherOrders, pct: Math.round((otherOrders / totalOrders) * 100), other: true }]
      : []),
  ];
  return (
    <div className="rad">
      <section className="rad-kpis" aria-label="This month in numbers">
        {kpis.map((k) => (
          <article key={k.label} className="ui-panel rad-kpi">
            <span className="rad-kpi__label">{k.label}</span>
            <div className="rad-kpi__mid">
              <span className="rad-kpi__value">{k.value.toLocaleString()}</span>
              {k.spark ? (
                <svg className="rad-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
                  <path d={sparklinePath(k.spark)} fill="none" strokeWidth="2" />
                </svg>
              ) : null}
            </div>
            <span className="rad-kpi__delta">
              <span className={k.deltaPct >= 0 ? "is-up" : "is-down"} aria-hidden>
                {k.deltaPct >= 0 ? "↑" : "↓"}
              </span>{" "}
              {k.deltaPct >= 0 ? "+" : "−"}
              {Math.abs(k.deltaPct)}% vs last month
            </span>
          </article>
        ))}
      </section>

      <div className="rad-body">
        <div className="rad-col">
          <article className="ui-panel" aria-labelledby="rad-trend-title">
            <header className="rad-head">
              <div>
                <h2 id="rad-trend-title" className="ui-section-title">
                  Orders by fuel
                </h2>
                <p className="rad-sub">Orders containing each fuel, last 6 months</p>
              </div>
              <div className="rad-legend" aria-hidden>
                <span>
                  <i className="rad-dot rad-dot--pms" /> PMS
                </span>
                <span>
                  <i className="rad-dot rad-dot--ago" /> AGO
                </span>
              </div>
            </header>
            <OrderTrendChart points={trend} />
            <details className="rad-table-view">
              <summary>Show as a table</summary>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>PMS orders</th>
                    <th>AGO orders</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((p) => (
                    <tr key={p.label}>
                      <td>{p.label}</td>
                      <td>{p.pms}</td>
                      <td>{p.ago}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </article>

          <article className="ui-panel" aria-labelledby="rad-recent-title">
            <header className="rad-head">
              <h2 id="rad-recent-title" className="ui-section-title">
                Recent orders
              </h2>
              <Link href="/intelligence/retail/orders?stage=all" className="ui-navlink">
                View all orders
              </Link>
            </header>
            {recentOrders.length === 0 ? (
              <p className="rad-empty">No dealer orders yet.</p>
            ) : (
              <ul className="rad-orders">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <span className="rad-orders__ref">
                      <b>{o.reference}</b>
                      <span>
                        {o.dealer} · {o.station}
                      </span>
                    </span>
                    <span className="rad-orders__fuel">
                      {o.products} · {o.volume}
                    </span>
                    <span className="rad-orders__date">{o.created}</span>
                    <StatusChip status={o.orderStatus} label={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className="rad-col">
          <article className="ui-panel" aria-labelledby="rad-status-title">
            <header className="rad-head">
              <div>
                <h2 id="rad-status-title" className="ui-section-title">
                  Orders by status
                </h2>
                <p className="rad-sub">
                  This month · {totalOrders.toLocaleString()} {totalOrders === 1 ? "order" : "orders"}
                </p>
              </div>
            </header>
            <ul className="rad-bars">
              {statusRows.map((s) => (
                <li key={s.name} title={`${s.name}: ${s.count} (${s.pct}%)`}>
                  <span className="rad-bars__name">{s.name}</span>
                  <span className="rad-bars__value">
                    {s.count} · {s.pct}%
                  </span>
                  <span className="rad-bars__track" aria-hidden>
                    <span className={s.other ? "is-other" : undefined} style={{ width: `${s.pct}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="ui-panel" aria-labelledby="rad-stations-title">
            <header className="rad-head">
              <div>
                <h2 id="rad-stations-title" className="ui-section-title">
                  Top stations
                </h2>
                <p className="rad-sub">Litres ordered this month</p>
              </div>
            </header>
            {topStations.length === 0 ? (
              <p className="rad-empty">No station volume yet.</p>
            ) : (
              <ol className="rad-bars">
                {topStations.map((s) => (
                  <li key={s.name} title={`${s.name}: ${s.litres.toLocaleString()} L`}>
                    <span className="rad-bars__name">{s.name}</span>
                    <span className="rad-bars__value">{s.litres.toLocaleString()} L</span>
                    <span className="rad-bars__track" aria-hidden>
                      <span style={{ width: `${Math.max(s.pct, 2)}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

/** Clean axis ticks: 0 and up to 4 round steps covering the largest value. */
function ticksFor(max: number) {
  const raw = Math.max(1, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(Math.max(1, max) / step) + 1 }, (_, i) => i * step);
}

function OrderTrendChart({ points }: { points: TrendPoint[] }) {
  const w = 640;
  const h = 230;
  const pad = { t: 16, r: 64, b: 32, l: 40 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const ticks = ticksFor(Math.max(...points.flatMap((p) => [p.pms, p.ago])));
  const top = ticks[ticks.length - 1];
  const xAt = (i: number) => pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (v / top) * innerH;
  const pathFor = (key: "pms" | "ago") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const slot = points.length > 1 ? innerW / (points.length - 1) : innerW;
  return (
    <svg className="rad-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="PMS and AGO orders per month, last 6 months">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={yAt(t)} y2={yAt(t)} className="rad-trend__grid" />
          <text x={pad.l - 8} y={yAt(t) + 4} textAnchor="end" className="rad-trend__axis">
            {t.toLocaleString()}
          </text>
        </g>
      ))}
      <path d={pathFor("pms")} className="rad-trend__line rad-trend__line--pms" />
      <path d={pathFor("ago")} className="rad-trend__line rad-trend__line--ago" />
      {points.map((p, i) => (
        <g key={p.label} className="rad-trend__month">
          <title>{`${p.label}: PMS ${p.pms}, AGO ${p.ago}`}</title>
          <rect x={xAt(i) - slot / 2} y={pad.t} width={slot} height={innerH} className="rad-trend__hit" />
          <text x={xAt(i)} y={h - 8} textAnchor="middle" className={`rad-trend__axis${i === last ? " is-current" : ""}`}>
            {p.label.replace(/ \d{4}$/, "")}
          </text>
        </g>
      ))}
      {last >= 0 ? (
        <>
          <circle cx={xAt(last)} cy={yAt(points[last].pms)} r="4" className="rad-trend__end rad-trend__end--pms" />
          <circle cx={xAt(last)} cy={yAt(points[last].ago)} r="4" className="rad-trend__end rad-trend__end--ago" />
          <text x={xAt(last) + 10} y={yAt(points[last].pms) + 4} className="rad-trend__label">
            PMS {points[last].pms}
          </text>
          <text x={xAt(last) + 10} y={yAt(points[last].ago) + (points[last].ago === points[last].pms ? 18 : 4)} className="rad-trend__label">
            AGO {points[last].ago}
          </text>
        </>
      ) : null}
    </svg>
  );
}
