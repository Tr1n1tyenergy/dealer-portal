import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  Fuel,
  Hourglass,
  MapPin,
  Users,
} from "lucide-react";
import {
  STATUS_BUCKET_COLORS,
  type AnalyticsStatusBucket,
  sparklinePath,
} from "@/lib/retail/analytics";

export type RetailKpi = {
  label: string;
  value: number;
  deltaPct: number;
  spark: number[];
  tone: "blue" | "gold" | "purple" | "green";
  icon: "orders" | "invites" | "orgs" | "stations";
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
  tone: string;
  created: string;
};

export type StationVolumeRow = {
  name: string;
  litres: number;
  pct: number;
};

export function RetailAnalyticsDashboard({
  welcomeName,
  dateRangeLabel,
  kpis,
  trend,
  statusSlices,
  totalOrders,
  recentOrders,
  topStations,
}: {
  welcomeName: string;
  dateRangeLabel: string;
  kpis: RetailKpi[];
  trend: TrendPoint[];
  statusSlices: StatusSlice[];
  totalOrders: number;
  recentOrders: RecentOrderRow[];
  topStations: StationVolumeRow[];
}) {
  return (
    <div className="rad">
      {/* Media uses fixed height (not 100%) so it never stretches behind charts */}
      <section className="rad-top">
        <div className="rad-hero__media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets2/img/retail/dashboard-hero-station.jpg"
            alt=""
            className="rad-hero__img"
          />
          <div className="rad-hero__fade" />
        </div>
        <div className="rad-hero__copy">
          <h1 className="rad-hero__title">
            Welcome back, <span>{welcomeName}</span>
          </h1>
          <p className="rad-hero__sub">
            Here&apos;s an overview of dealer orders and retail operations across Trinity.
          </p>
        </div>
        <button type="button" className="rad-date" aria-label="Date range">
          <CalendarDays size={15} strokeWidth={1.75} />
          <span>{dateRangeLabel}</span>
          <ChevronDown size={14} strokeWidth={2} />
        </button>

        <section className="rad-kpis">
          {kpis.map((k) => (
            <article key={k.label} className={`rad-kpi rad-kpi--${k.tone}`}>
              <span className="rad-kpi__icon" aria-hidden>
                {kpiIcon(k.icon)}
              </span>
              <div className="rad-kpi__body">
                <span className="rad-kpi__label">{k.label}</span>
                <div className="rad-kpi__mid">
                  <span className="rad-kpi__value">{k.value.toLocaleString()}</span>
                  <svg className="rad-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none">
                    <path d={sparklinePath(k.spark)} fill="none" strokeWidth="2.4" />
                  </svg>
                </div>
                <span className={`rad-kpi__delta ${k.deltaPct >= 0 ? "is-up" : "is-down"}`}>
                  {k.deltaPct >= 0 ? "↑ +" : "↓ "}
                  {Math.abs(k.deltaPct)}% vs last month
                </span>
              </div>
            </article>
          ))}
        </section>
      </section>

      <div className="rad-body">
        <div className="rad-col rad-col--main">
          <article className="rad-card rad-trend">
            <header className="rad-card__head">
              <div className="rad-card__title">
                <BarChart3 size={16} strokeWidth={1.75} />
                <span>Order Trend</span>
              </div>
              <button type="button" className="rad-select">
                Last 6 Months <ChevronDown size={13} />
              </button>
            </header>
            <OrderTrendChart points={trend} />
            <div className="rad-legend">
              <span>
                <i className="rad-dot rad-dot--pms" /> PMS Orders
              </span>
              <span>
                <i className="rad-dot rad-dot--ago" /> AGO Orders
              </span>
            </div>
          </article>

          <article className="rad-card rad-orders">
            <header className="rad-card__head">
              <div className="rad-card__title">
                <FileText size={16} strokeWidth={1.75} />
                <span>Recent Orders</span>
              </div>
              <Link href="/intelligence/reports/dealer-operations" className="rad-link">
                View all orders
              </Link>
            </header>
            <div className="rad-table-wrap">
              <table className="rad-table">
                <thead>
                  <tr>
                    <th>Order Ref</th>
                    <th>Dealer</th>
                    <th>Station</th>
                    <th>Products</th>
                    <th>Volume</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="rad-empty">
                        No dealer orders yet.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="rad-mono">{o.reference}</td>
                        <td>{o.dealer}</td>
                        <td>{o.station}</td>
                        <td>{o.products}</td>
                        <td>{o.volume}</td>
                        <td>
                          <span className={`rad-pill rad-pill--${o.tone}`}>{o.status}</span>
                        </td>
                        <td>{o.created}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="rad-col rad-col--side">
          <article className="rad-card rad-status">
            <header className="rad-card__head">
              <div className="rad-card__title">
                <Clock3 size={16} strokeWidth={1.75} />
                <span>Orders by Status</span>
              </div>
              <button type="button" className="rad-select">
                This Month <ChevronDown size={13} />
              </button>
            </header>
            <div className="rad-status__body">
              <StatusDonut slices={statusSlices} total={totalOrders} />
              <ul className="rad-status__legend">
                {statusSlices.map((s) => (
                  <li key={s.bucket}>
                    <span
                      className="rad-status__swatch"
                      style={{ background: STATUS_BUCKET_COLORS[s.bucket] }}
                    />
                    <span className="rad-status__name">{s.bucket}</span>
                    <span className="rad-status__pct">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rad-card rad-stations">
            <header className="rad-card__head">
              <div className="rad-card__title">
                <MapPin size={16} strokeWidth={1.75} />
                <span>Top Stations by Order Volume</span>
              </div>
              <button type="button" className="rad-select">
                This Month <ChevronDown size={13} />
              </button>
            </header>
            <ol className="rad-rank">
              {topStations.length === 0 ? (
                <li className="rad-empty">No station volume yet.</li>
              ) : (
                topStations.map((s, i) => (
                  <li key={s.name}>
                    <span className="rad-rank__n">{i + 1}</span>
                    <div className="rad-rank__meta">
                      <div className="rad-rank__row">
                        <strong>{s.name}</strong>
                        <em>
                          {s.litres.toLocaleString()} L · {s.pct}%
                        </em>
                      </div>
                      <div className="rad-rank__bar">
                        <span style={{ width: `${Math.max(s.pct, 4)}%` }} />
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </article>
        </div>
      </div>
    </div>
  );
}

function kpiIcon(kind: RetailKpi["icon"]) {
  if (kind === "orders") return <FileText size={22} strokeWidth={1.75} />;
  if (kind === "invites") return <Hourglass size={22} strokeWidth={1.75} />;
  if (kind === "orgs") return <Users size={22} strokeWidth={1.75} />;
  return <Fuel size={22} strokeWidth={1.75} />;
}

function OrderTrendChart({ points }: { points: TrendPoint[] }) {
  const w = 640;
  const h = 220;
  const pad = { t: 16, r: 12, b: 32, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(1, ...points.flatMap((p) => [p.pms, p.ago]));
  const xAt = (i: number) =>
    pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (v / maxY) * innerH;

  const pathFor = (key: "pms" | "ago") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`)
      .join(" ");

  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.t + innerH * (1 - t));

  return (
    <svg className="rad-trend__svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Order trend">
      {grid.map((y) => (
        <line
          key={y}
          x1={pad.l}
          x2={w - pad.r}
          y1={y}
          y2={y}
          className="rad-trend__grid"
        />
      ))}
      <path d={pathFor("pms")} className="rad-trend__line rad-trend__line--pms" />
      <path d={pathFor("ago")} className="rad-trend__line rad-trend__line--ago" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={xAt(i)} cy={yAt(p.pms)} r="3.5" className="rad-trend__dot rad-trend__dot--pms" />
          <circle cx={xAt(i)} cy={yAt(p.ago)} r="3.5" className="rad-trend__dot rad-trend__dot--ago" />
          <text x={xAt(i)} y={h - 8} textAnchor="middle" className="rad-trend__xlabel">
            {p.label.replace(/ \d{4}$/, "")}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StatusDonut({ slices, total }: { slices: StatusSlice[]; total: number }) {
  const size = 152;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;
  const stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="rad-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} className="rad-donut__track" strokeWidth={stroke} />
        {slices.map((s) => {
          const len = total > 0 ? (s.count / total) * circ : 0;
          const el = (
            <circle
              key={s.bucket}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={STATUS_BUCKET_COLORS[s.bucket]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="rad-donut__center">
        <strong>{total}</strong>
        <span>Total Orders</span>
      </div>
    </div>
  );
}
