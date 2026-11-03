/** "Fuel ordered": litres per month as stacked columns, PMS (blue) under AGO (teal); chart option A, 3 Nov. */
export function FuelChart({ months }: { months: { label: string; pms: number; ago: number }[] }) {
  // Drawn at about the panel's width, so the 13px labels stay close to 13px on screen.
  const w = 720;
  const h = 240;
  const pad = { t: 22, r: 8, b: 28, l: 40 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(1, ...months.map((m) => m.pms + m.ago));
  const step = [1, 2, 5, 10, 20, 50].map((k) => k * 10 ** Math.floor(Math.log10(max / 3))).find((s) => s * 3 >= max) ?? max;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;
  const slot = innerW / months.length;
  const bar = Math.min(24, slot * 0.5);
  const compact = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v));
  // A column with a rounded top (4px) and a square foot on the baseline.
  const column = (x: number, y0: number, y1: number) => {
    const r = Math.min(4, (y0 - y1) / 2);
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bar - r} Q${x + bar},${y1} ${x + bar},${y1 + r} V${y0} Z`;
  };
  return (
    <svg className="fc" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Litres ordered per month, last 6 months, PMS and AGO">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="fc__grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fc__axis">
            {compact(t)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = pad.l + slot * i + (slot - bar) / 2;
        const total = m.pms + m.ago;
        const base = y(0);
        const pmsTop = y(m.pms);
        const current = i === months.length - 1;
        return (
          <g key={m.label} className="fc__month">
            <title>{`${m.label}: PMS ${m.pms.toLocaleString()} L, AGO ${m.ago.toLocaleString()} L, total ${total.toLocaleString()} L`}</title>
            <rect x={pad.l + slot * i} y={pad.t} width={slot} height={innerH} className="fc__hit" />
            {m.pms > 0 ? (
              m.ago > 0 ? (
                <rect x={x} y={pmsTop} width={bar} height={base - pmsTop} className="fc__pms" />
              ) : (
                <path d={column(x, base, pmsTop)} className="fc__pms" />
              )
            ) : null}
            {m.ago > 0 ? <path d={column(x, m.pms > 0 ? pmsTop - 2 : base, y(total) - (m.pms > 0 ? 2 : 0))} className="fc__ago" /> : null}
            {total > 0 ? (
              <text x={x + bar / 2} y={y(total) - 8} textAnchor="middle" className="fc__value">
                {compact(total)}
              </text>
            ) : null}
            <text x={x + bar / 2} y={h - 8} textAnchor="middle" className={`fc__axis${current ? " is-current" : ""}`}>
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
