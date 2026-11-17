import Link from "next/link";
import type { AnalyticsData } from "@/lib/insights/load";
import { formatWait, timeAgo } from "@/lib/insights/live";
import type { Pair } from "@/lib/insights/figures";
import { sparklinePath } from "@/lib/retail/analytics";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import { AnalyticsAutoRefresh } from "./analytics-auto-refresh";
import { AnalyticsLitresChart } from "./analytics-litres-chart";

const litres = (n: number) => `${n.toLocaleString("en-GB")} L`;
const kes = (n: number) => (n >= 1_000_000 ? `KES ${(n / 1_000_000).toFixed(1)}M` : `KES ${Math.round(n).toLocaleString("en-GB")}`);
const clock = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
const prevMonthName = (d: Date) => nairobiMonthStart(d, -1).toLocaleString("en-GB", { month: "short", timeZone: "Africa/Nairobi" });

function Change({ pair, vs }: { pair: Pair; vs: string }) {
  if (pair.change == null) {
    return <span className="sa-chg">{pair.now > 0 ? "New this month" : "—"}</span>;
  }
  const up = pair.change >= 0;
  return (
    <span className={`sa-chg ${up ? "sa-chg--up" : "sa-chg--down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pair.change)}% <span>vs {vs}</span>
    </span>
  );
}

function Spark({ values }: { values: number[] }) {
  return (
    <svg className="sa-spark" viewBox="0 0 120 36" aria-hidden>
      <path d={sparklinePath(values)} />
    </svg>
  );
}

const EVENT_TONE: Record<string, string> = {
  PAYMENT_CONFIRMED: "good",
  RELEASED_TO_DEPOT: "good",
  DISPATCHED: "good",
  DELIVERED: "good",
  PAYMENT_SUBMITTED: "warn",
};

export function StaffAnalytics({ data }: { data: AnalyticsData }) {
  const { figures, monthly } = data;
  const vs = prevMonthName(data.updatedAt);
  const openCount = data.stages.reduce((s, t) => s + t.count, 0);
  const stuck = data.stuckAll.slice(0, 3);
  const maxWarehouse = Math.max(1, ...data.warehouses.flatMap((w) => [w.litres, w.prevLitres]));
  const maxCycle = Math.max(1, ...data.cycles.map((c) => c.medianMs ?? 0));
  const slowest = data.cycles.find((c) => c.slowest);

  const kpis = [
    { label: "Litres this month", value: litres(figures.litres.now), pair: figures.litres, spark: monthly.map((m) => m.pms + m.ago) },
    { label: "Value incl. VAT", value: kes(figures.value.now), pair: figures.value, spark: monthly.map((m) => m.value) },
    { label: "Orders placed", value: String(figures.orders.now), pair: figures.orders, spark: monthly.map((m) => m.orders) },
    {
      label: "Active dealers",
      value: String(figures.activeDealers.now),
      extra: `of ${data.totalDealers}`,
      pair: figures.activeDealers,
      spark: monthly.map((m) => m.dealers),
    },
  ];

  return (
    <div className="so sa">
      <AnalyticsAutoRefresh />
      <header className="so-hero" aria-label="Analytics hero">
        <div className="so-hero__text">
          <div className="so-hero__eyebrow">Analytics</div>
          <h1>How the business is doing</h1>
          <p>Orders, litres and dealers across all stations. Updates every minute.</p>
          <div className="sa-updated">
            <span className="sa-updated__dot" aria-hidden />
            Updated {clock(data.updatedAt)}
          </div>
        </div>
      </header>

      <div className="so-wrap sa-wrap">
        <section className="sa-kpis" aria-label="This month">
          {kpis.map((k, i) => (
            <div key={k.label} className={`so-card sa-kpi${i === 0 ? " is-lead" : ""}`}>
              <div className="sa-kpi__label">{k.label}</div>
              <div className="sa-kpi__value">
                {k.value}
                {k.extra ? <small>{k.extra}</small> : null}
              </div>
              <div className="sa-kpi__foot">
                <Change pair={k.pair} vs={vs} />
                <Spark values={k.spark} />
              </div>
            </div>
          ))}
        </section>

        <section className="so-card sa-live" aria-label="Live">
          <div className="sa-live__part">
            <div className="sa-sec">
              <h2>Orders by stage</h2>
              <small>{openCount} open · tap a stage to open Orders</small>
            </div>
            <div className="sa-stages">
              {data.stages.map((s) => (
                <Link key={s.key} href={`/intelligence/retail/orders?stage=${s.key}`} className={`sa-stage${s.busiest ? " is-busiest" : ""}`}>
                  <b>{s.count}</b>
                  <span>{s.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="sa-live__part">
            <div className="sa-sec">
              <h2>Stuck</h2>
              <small>over their stage limit</small>
            </div>
            {stuck.length ? (
              <div className="sa-stuck">
                {stuck.map((s) => (
                  <Link key={s.id} href={`/intelligence/retail/orders/${s.id}`}>
                    <span className="sa-stuck__ref">{s.reference}</span>
                    <span className="sa-stuck__wait">{formatWait(s.waitedMs)}</span>
                    <span className="sa-stuck__meta">{s.dealerName} · {s.stageLabel}</span>
                    <span className="sa-stuck__lim">limit {s.limitHours} h</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="sa-empty">Nothing stuck right now.</p>
            )}
            {data.stuckAll.length > 3 ? <p className="sa-more">+{data.stuckAll.length - 3} more stuck</p> : null}
          </div>

          <div className="sa-live__part">
            <div className="sa-sec">
              <h2>Happening now</h2>
              <small>latest {data.events.length || ""}</small>
            </div>
            {data.events.length ? (
              <ul className="sa-events">
                {data.events.map((e, i) => (
                  <li key={`${e.orderId}-${i}`}>
                    <i className={`sa-events__dot sa-events__dot--${EVENT_TONE[e.status] ?? "info"}`} aria-hidden />
                    <Link href={`/intelligence/retail/orders/${e.orderId}`}>{e.text}</Link>
                    <time dateTime={e.at.toISOString()}>{timeAgo(e.at, data.updatedAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sa-empty">No order activity yet.</p>
            )}
          </div>
        </section>

        <div className="sa-row2">
          <AnalyticsLitresChart series={monthly.map(({ key, label, pms, ago }) => ({ key, label, pms, ago }))} />

          <section className="so-card sa-card" aria-labelledby="sa-cycle-title">
            <div className="sa-card__h">
              <h2 id="sa-cycle-title">How long orders take</h2>
              <small>median, this month</small>
            </div>
            <div className="sa-card__b sa-cycle">
              {data.cycles.map((c) => (
                <div key={c.label} className={c.slowest ? "is-slowest" : undefined}>
                  <span>{c.label}</span>
                  <b>{c.medianMs == null ? "—" : formatWait(c.medianMs)}</b>
                  <span className="sa-bar" aria-hidden>
                    <i style={{ width: `${c.medianMs == null ? 0 : Math.max(4, (c.medianMs / maxCycle) * 100)}%` }} />
                  </span>
                </div>
              ))}
              {slowest ? <p className="sa-note">Slowest step this month: {slowest.label.toLowerCase()}.</p> : <p className="sa-empty">No finished steps this month yet.</p>}
            </div>
          </section>
        </div>

        <div className="sa-row3">
          <section className="so-card sa-card" aria-labelledby="sa-wh-title">
            <div className="sa-card__h">
              <h2 id="sa-wh-title">By loading depot</h2>
              <small>litres this month · marker = {vs}</small>
            </div>
            <div className="sa-card__b sa-hbars">
              {data.warehouses.length ? (
                data.warehouses.map((w) => (
                  <div key={w.name} className="sa-hb">
                    <span>{w.name}</span>
                    <b>{litres(w.litres)}</b>
                    <span className="sa-hb__track" aria-hidden>
                      <i style={{ width: `${(w.litres / maxWarehouse) * 100}%` }} />
                      <em style={{ left: `${(w.prevLitres / maxWarehouse) * 100}%` }} />
                    </span>
                  </div>
                ))
              ) : (
                <p className="sa-empty">No orders yet this month.</p>
              )}
            </div>
          </section>

          <section className="so-card sa-card" aria-labelledby="sa-top-title">
            <div className="sa-card__h">
              <h2 id="sa-top-title">Top 5 dealers</h2>
              <small>litres this month</small>
            </div>
            <div className="sa-card__b">
              {data.top.length ? (
                <ol className="sa-rank">
                  {data.top.map((d) => (
                    <li key={d.name}><span>{d.name}</span><b>{litres(d.litres)}</b></li>
                  ))}
                </ol>
              ) : (
                <p className="sa-empty">No orders yet this month.</p>
              )}
            </div>
          </section>

          <section className="so-card sa-card" aria-labelledby="sa-quiet-title">
            <div className="sa-card__h">
              <h2 id="sa-quiet-title">Gone quiet</h2>
              <small>no order in 30+ days</small>
            </div>
            <div className="sa-card__b">
              {data.quiet.length ? (
                <ol className="sa-rank sa-rank--quiet">
                  {data.quiet.map((d) => (
                    <li key={d.name}><span>{d.name}</span><b className="sa-days">{d.days} days</b></li>
                  ))}
                </ol>
              ) : (
                <p className="sa-empty">No dealer has gone quiet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
