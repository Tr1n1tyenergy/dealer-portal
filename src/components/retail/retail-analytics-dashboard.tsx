import Link from "next/link";
import { sparklinePath } from "@/lib/retail/analytics";
import { formatWaited } from "@/lib/insights/order-flow";
import { formatKes } from "@/lib/orders/money";
import { statusLabel } from "@/lib/orders/stages";
import { OrderTrendChart } from "./order-trend-chart";

export type TrendPoint = { label: string; pms: number; ago: number };

type Props = {
  tiles: { key: string; label: string; tab: string; count: number }[];
  stuck: { id: string; reference: string; dealer: string; status: string; waitedMs: number }[];
  stuckCount: number;
  events: { id: string; at: string; text: string; amount: string | null }[];
  kpis: { label: string; value: string; title?: string; delta: number; spark: number[] }[];
  litres: TrendPoint[];
  cycle: { step: string; medianMs: number | null }[];
  regions: { region: string; thisMonth: number; lastMonth: number }[];
  dealers: { dealer: string; litres: number }[];
  quiet: { name: string; days: number | null }[];
  nowIso: string;
};

const ORDERS = "/intelligence/retail/orders";
const ago = (iso: string, now: number) => {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60e3));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
};
const kl = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}K L` : `${n.toLocaleString("en-KE")} L`);
const duration = (ms: number | null) => {
  if (ms === null) return "—";
  const h = ms / 3600e3;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60e3))} min`;
  return h < 24 ? `${Math.round(h * 10) / 10} hours` : `${Math.round((h / 24) * 10) / 10} days`;
};

/** Staff Analytics, direction C: live strip (stages, stuck, happening now), the month's figures, then the business picture. */
export function RetailAnalyticsDashboard(p: Props) {
  const now = new Date(p.nowIso).getTime();
  const busiest = Math.max(0, ...p.tiles.map((t) => t.count));
  const slowest = Math.max(0, ...p.cycle.map((c) => c.medianMs ?? 0));
  const regionMax = Math.max(1, ...p.regions.flatMap((r) => [r.thisMonth, r.lastMonth]));
  const dealerMax = Math.max(1, ...p.dealers.map((d) => d.litres));
  return (
    <div className="rad">
      <section className="rad-strip" aria-label="Right now">
        <div className="rad-strip__main">
          <div className="rad-head">
            <h2 className="ui-section-title">Orders by stage</h2>
            <span className="rad-sub">
              {p.stuckCount} stuck · {p.tiles.find((t) => t.key === "checking")?.count ?? 0} payments to check
            </span>
          </div>
          <ol className="rad-tiles">
            {p.tiles.map((t) => (
              <li key={t.key}>
                <Link href={`${ORDERS}?stage=${t.tab}`} className={`rad-tile${t.count > 0 && t.count === busiest ? " is-busiest" : ""}`}>
                  <b>{t.count}</b>
                  <span>{t.label}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="rad-head" style={{ marginTop: 14 }}>
            <h2 className="ui-section-title">Stuck</h2>
            <Link href={`${ORDERS}?stage=stuck`} className="ui-navlink">
              See all stuck orders
            </Link>
          </div>
          {p.stuck.length === 0 ? (
            <p className="rad-empty">Nothing stuck right now.</p>
          ) : (
            <ul className="rad-stuck">
              {p.stuck.map((s) => (
                <li key={s.id}>
                  <span>
                    <b>{s.reference}</b>
                    <em>
                      {s.dealer} · {statusLabel(s.status)}
                    </em>
                  </span>
                  <span className="ui-chip ui-chip--problem">{formatWaited(s.waitedMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rad-strip__feed">
          <h2 className="ui-section-title">Happening now</h2>
          {p.events.length === 0 ? (
            <p className="rad-empty">No order activity yet.</p>
          ) : (
            <ul className="rad-feed">
              {p.events.map((e, i) => (
                <li key={e.id} className={i === 0 ? "is-new" : undefined}>
                  <span className="rad-feed__ago">{ago(e.at, now)}</span>
                  <span>{e.text}</span>
                  {e.amount ? <b>{formatKes(e.amount)}</b> : <b />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rad-kpis" aria-label="This month in numbers">
        {p.kpis.map((k) => (
          <article key={k.label} className="ui-panel rad-kpi">
            <span className="rad-kpi__label">{k.label}</span>
            <div className="rad-kpi__mid">
              <span className="rad-kpi__value" title={k.title}>
                {k.value}
              </span>
              {k.spark.some((v) => v > 0) ? (
                <svg className="rad-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
                  <path d={sparklinePath(k.spark)} fill="none" strokeWidth="2" />
                </svg>
              ) : null}
            </div>
            <span className="rad-kpi__delta">
              <span className={k.delta >= 0 ? "is-up" : "is-down"} aria-hidden>
                {k.delta >= 0 ? "↑" : "↓"}
              </span>{" "}
              {k.delta >= 0 ? "+" : "−"}
              {Math.abs(k.delta)}% vs last month
            </span>
          </article>
        ))}
      </section>

      <div className="rad-body">
        <article className="ui-panel" aria-labelledby="rad-litres">
          <header className="rad-head">
            <div>
              <h2 id="rad-litres" className="ui-section-title">
                Litres ordered
              </h2>
              <p className="rad-sub">Per month, last 12 months · this month so far</p>
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
          <OrderTrendChart points={p.litres} unit="litres" />
          <details className="rad-table-view">
            <summary>Show as a table</summary>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>PMS</th>
                  <th>AGO</th>
                </tr>
              </thead>
              <tbody>
                {p.litres.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <td>{m.pms.toLocaleString("en-KE")} L</td>
                    <td>{m.ago.toLocaleString("en-KE")} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </article>

        <article className="ui-panel" aria-labelledby="rad-cycle">
          <h2 id="rad-cycle" className="ui-section-title">
            How long orders take
          </h2>
          <p className="rad-sub">Median per step, orders placed this month · slowest in yellow</p>
          <ul className="rad-cyc">
            {p.cycle.map((c) => (
              <li key={c.step}>
                <span>{c.step}</span>
                <span className="rad-bars__track" aria-hidden>
                  <span className={c.medianMs !== null && c.medianMs === slowest && slowest > 0 ? "is-slow" : undefined} style={{ width: `${c.medianMs && slowest ? (c.medianMs / slowest) * 100 : 0}%` }} />
                </span>
                <b>{duration(c.medianMs)}</b>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="rad-three">
        <article className="ui-panel" aria-labelledby="rad-region">
          <h2 id="rad-region" className="ui-section-title">
            By loading region
          </h2>
          <p className="rad-sub">Litres this month · the dark tick is last month</p>
          <ul className="rad-bars">
            {p.regions.map((r) => (
              <li key={r.region} title={`${r.region}: ${r.thisMonth.toLocaleString("en-KE")} L this month, ${r.lastMonth.toLocaleString("en-KE")} L last month`}>
                <span className="rad-bars__name">{r.region}</span>
                <span className="rad-bars__value">{kl(r.thisMonth)}</span>
                <span className="rad-bars__track rad-bars__track--tick" aria-hidden>
                  <span style={{ width: `${(r.thisMonth / regionMax) * 100}%` }} />
                  <i style={{ left: `${(r.lastMonth / regionMax) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="ui-panel" aria-labelledby="rad-dealers">
          <h2 id="rad-dealers" className="ui-section-title">
            Top dealers
          </h2>
          <p className="rad-sub">Litres this month</p>
          {p.dealers.length === 0 ? (
            <p className="rad-empty">No orders this month yet.</p>
          ) : (
            <ol className="rad-bars">
              {p.dealers.map((d) => (
                <li key={d.dealer}>
                  <span className="rad-bars__name">{d.dealer}</span>
                  <span className="rad-bars__value">{kl(d.litres)}</span>
                  <span className="rad-bars__track" aria-hidden>
                    <span style={{ width: `${(d.litres / dealerMax) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
        <article className="ui-panel" aria-labelledby="rad-quiet">
          <h2 id="rad-quiet" className="ui-section-title">
            Gone quiet
          </h2>
          <p className="rad-sub">Dealers with no order in 30 days</p>
          {p.quiet.length === 0 ? (
            <p className="rad-empty">Every dealer ordered in the last 30 days.</p>
          ) : (
            <ul className="rad-quiet">
              {p.quiet.map((q) => (
                <li key={q.name}>
                  <span>{q.name}</span>
                  <em>{q.days === null ? "No orders yet" : `${q.days} days`}</em>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
