"use client";

import { useState } from "react";

type Point = { key: string; label: string; pms: number; ago: number };

/** 1, 2 or 5 × 10ⁿ at or above the value, so the axis reads 0 / 100k / 200k / 300k. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 3, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p);
}

const short = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

export function AnalyticsLitresChart({ series }: { series: Point[] }) {
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...series.flatMap((p) => [p.pms, p.ago])));
  const empty = series.every((p) => !p.pms && !p.ago);
  const W = 1100;
  const H = 300;
  const line = (pick: "pms" | "ago") =>
    series.map((p, i) => `${((i / Math.max(series.length - 1, 1)) * W).toFixed(1)},${(H - (p[pick] / max) * H).toFixed(1)}`).join(" ");

  return (
    <section className="so-card sa-card" aria-labelledby="sa-litres-title">
      <div className="sa-card__h">
        <div>
          <h2 id="sa-litres-title">Litres ordered, last 12 months</h2>
          <div className="sa-legend">
            <span><i className="sa-legend__pms" />PMS</span>
            <span><i className="sa-legend__ago" />AGO</span>
          </div>
        </div>
        <button type="button" className="sa-toggle" aria-pressed={table} onClick={() => setTable((t) => !t)}>
          {table ? "View as chart" : "View as table"}
        </button>
      </div>
      <div className="sa-card__b">
        {empty ? (
          <p className="sa-empty">No orders in the last 12 months.</p>
        ) : table ? (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr><th scope="col">Month</th><th scope="col">PMS (L)</th><th scope="col">AGO (L)</th></tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{p.label}</th>
                    <td>{p.pms.toLocaleString("en-GB")}</td>
                    <td>{p.ago.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sa-chart">
            <div className="sa-chart__y" aria-hidden>
              {[max, (max * 2) / 3, max / 3, 0].map((v) => <span key={v}>{short(Math.round(v))}</span>)}
            </div>
            <div className="sa-chart__plot">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="PMS and AGO litres ordered per month; use View as table for the numbers">
                {[0, 100, 200, 300].map((y) => (
                  <line key={y} x1="0" x2={W} y1={y} y2={y} className="sa-grid" vectorEffect="non-scaling-stroke" />
                ))}
                <polyline points={line("pms")} className="sa-line sa-line--pms" vectorEffect="non-scaling-stroke" />
                <polyline points={line("ago")} className="sa-line sa-line--ago" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="sa-chart__x" aria-hidden>
                {series.map((p) => <span key={p.key}>{p.label}</span>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
