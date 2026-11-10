"use client";

import { useState } from "react";
import { Fuel } from "lucide-react";

export type FuelMonthPoint = {
  key: string;
  label: string;
  pms: number;
  ago: number;
};

export function FuelOrderedPanel({ points }: { points: FuelMonthPoint[] }) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...points.map((p) => p.pms + p.ago));

  return (
    <article className="dd__card">
      <div className="dd__card-head">
        <div>
          <div className="dd__card-title">
            <span className="dd__card-icon">
              <Fuel size={15} strokeWidth={2} />
            </span>
            Fuel Ordered
          </div>
          <div className="dd__card-sub">Litres per month, last 6 months</div>
        </div>
        <button type="button" className="dd__card-link" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show as a chart" : "Show as a table"}
        </button>
      </div>

      {asTable ? (
        <table className="dd__table">
          <thead>
            <tr>
              <th>Month</th>
              <th>PMS (L)</th>
              <th>AGO (L)</th>
              <th>Total (L)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.pms.toLocaleString("en-US")}</td>
                <td>{p.ago.toLocaleString("en-US")}</td>
                <td>{(p.pms + p.ago).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="dd__chart">
          <div className="dd__chart-plot">
            {points.map((p) => {
              const total = p.pms + p.ago;
              const pmsH = p.pms <= 0 ? 0 : Math.max(3, Math.round((p.pms / max) * 100));
              const agoH = p.ago <= 0 ? 0 : Math.max(3, Math.round((p.ago / max) * 100));
              return (
                <div key={p.key} className="dd__chart-col" title={`${p.label}: ${total.toLocaleString()} L`}>
                  <div className="dd__chart-bars">
                    <span className="dd__chart-bar dd__chart-bar--pms" style={{ height: `${pmsH}%` }} />
                    <span className="dd__chart-bar dd__chart-bar--ago" style={{ height: `${agoH}%` }} />
                  </div>
                  <div className="dd__chart-month">{p.label}</div>
                </div>
              );
            })}
          </div>
          <div className="dd__chart-legend">
            <span className="is-pms">PMS</span>
            <span className="is-ago">AGO</span>
          </div>
        </div>
      )}
    </article>
  );
}
