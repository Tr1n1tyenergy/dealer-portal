"use client";

import { useWidth } from "@/components/ui/use-width";
import type { TrendPoint } from "./retail-analytics-dashboard";

/** Clean axis ticks: 0 and up to 4 round steps covering the largest value. */
function ticksFor(max: number) {
  const raw = Math.max(1, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(Math.max(1, max) / step) + 1 }, (_, i) => i * step);
}

/** PMS and AGO orders per month as two lines, drawn at the measured width so the 13px labels stay 13px. */
export function OrderTrendChart({ points }: { points: TrendPoint[] }) {
  const [box, w] = useWidth<HTMLDivElement>(640);
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
    <div ref={box}>
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
    </div>
  );
}
