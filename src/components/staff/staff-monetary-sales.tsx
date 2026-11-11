"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Fuel,
  List,
  Target,
  Wallet,
} from "lucide-react";
import type {
  PaymentSlice,
  ProductRevenueRow,
  TargetVsActualRow,
  TrendPoint,
} from "@/lib/stock-reporting/staff-monetary-sales";
import {
  formatKshCompact,
  formatKshSignedCompact,
} from "@/lib/stock-reporting/staff-monetary-sales";
import { formatLitresCell } from "@/lib/stock-reporting/staff-reconciliation";
import { formatPctRound } from "@/lib/stock-reporting/staff-stock-intelligence";
import type { StaffReportingPeriod } from "@/lib/stock-reporting/staff-reconciliation";

export type StaffMonetaryViewModel = {
  stationId: string;
  stationName: string;
  period: StaffReportingPeriod;
  periodLabel: string;
  dateIso: string;
  fromIso: string;
  toIso: string;
  pms: ProductRevenueRow;
  ago: ProductRevenueRow;
  totalVolume: number;
  totalRevenueKes: number;
  totalCollectionsKes: number;
  monetaryVarianceKes: number;
  dailyTargetKes: number | null;
  targetAchievementPct: number | null;
  payments: PaymentSlice[];
  targetRows: TargetVsActualRow[];
  trend: TrendPoint[];
  reportsIncluded: number;
  shiftsHref: string;
  exportBase: string;
};

function Donut({ slices, total }: { slices: PaymentSlice[]; total: number }) {
  if (total <= 0 || slices.every((s) => s.amountKes <= 0)) {
    return <p className="ssr-empty-inline">No collections for this period.</p>;
  }
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="sms-donut">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden>
        <g transform="translate(70,70) rotate(-90)">
          {slices.map((s) => {
            const len = (s.pct / 100) * c;
            const el = (
              <circle
                key={s.key}
                r={r}
                fill="transparent"
                stroke={s.color}
                strokeWidth={18}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="sms-donut__center">
        <strong>{formatKshCompact(total)}</strong>
        <span>Total</span>
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const values = points.flatMap((p) => [p.actualKes, p.targetKes].filter((v): v is number => v != null));
  const max = Math.max(1, ...values) * 1.15;
  const w = 420;
  const h = 180;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(1, points.length);
  const gap = innerW / n;

  const linePts = points
    .map((p, i) => {
      if (p.targetKes == null) return null;
      const x = padL + gap * i + gap / 2;
      const y = padT + innerH - (p.targetKes / max) * innerH;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg className="sms-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Revenue trend">
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH - t * innerH;
        return (
          <line key={t} x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e8eef5" strokeWidth={1} />
        );
      })}
      {points.map((p, i) => {
        const x = padL + gap * i + gap * 0.2;
        const barW = gap * 0.6;
        if (p.missing || p.actualKes == null) {
          return (
            <rect
              key={p.key}
              x={x}
              y={padT + innerH - 4}
              width={barW}
              height={4}
              rx={2}
              fill="#e2e8f0"
            />
          );
        }
        const bh = (p.actualKes / max) * innerH;
        return (
          <rect
            key={p.key}
            x={x}
            y={padT + innerH - bh}
            width={barW}
            height={bh}
            rx={3}
            fill="#3551a5"
          >
            <title>
              {p.label}: {formatKshCompact(p.actualKes)}
              {p.targetKes != null ? ` / target ${formatKshCompact(p.targetKes)}` : ""}
            </title>
          </rect>
        );
      })}
      {linePts ? (
        <polyline
          points={linePts}
          fill="none"
          stroke="#ffcc00"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ) : null}
      {points.map((p, i) => {
        if (p.targetKes == null) return null;
        const x = padL + gap * i + gap / 2;
        const y = padT + innerH - (p.targetKes / max) * innerH;
        return <circle key={`t-${p.key}`} cx={x} cy={y} r={3.5} fill="#ffcc00" stroke="#fff" strokeWidth={1} />;
      })}
      {points.map((p, i) => {
        const x = padL + gap * i + gap / 2;
        return (
          <text key={`l-${p.key}`} x={x} y={h - 8} textAnchor="middle" fontSize={9} fill="#64748b">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

function priceLabel(row: ProductRevenueRow): string {
  if (row.multiPrice && row.weightedAveragePrice != null) {
    return `Avg ${row.weightedAveragePrice.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (row.unitPrice == null) return "—";
  return row.unitPrice.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StaffMonetarySalesPanel({
  view,
  onPeriodChange,
  onDateChange,
  onCustomChange,
}: {
  view: StaffMonetaryViewModel;
  onPeriodChange: (period: StaffReportingPeriod) => void;
  onDateChange: (iso: string) => void;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const periods: { key: StaffReportingPeriod; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "custom", label: "Custom Range" },
  ];

  useEffect(() => {
    if (!exportOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExportOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportOpen]);

  const varTone =
    Math.abs(view.monetaryVarianceKes) < 0.015
      ? "ok"
      : view.monetaryVarianceKes < 0
        ? "bad"
        : "warn";

  return (
    <section className="ssr-main" aria-label="Monetary Sales workspace">
      <div className="ssr-main__top">
        <div>
          <div className="ssr-main__title-row">
            <h2 className="ssr-main__title">Monetary Sales — {view.stationName}</h2>
          </div>
          <p className="ssr-main__sub">
            Revenue, collections and target performance for the selected period.
          </p>
        </div>
        <div className="ssr-actions">
          <div className={`ssr-export${exportOpen ? " is-open" : ""}`} ref={exportMenuRef}>
            <button
              type="button"
              className="ssr-btn ssr-btn--outline"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              <Download size={15} aria-hidden />
              Export Report
              <ChevronDown size={14} aria-hidden />
            </button>
            {exportOpen ? (
              <div className="ssr-export__menu" role="menu" aria-label="Export formats">
                <a
                  role="menuitem"
                  className="ssr-export__item"
                  href={`${view.exportBase}&format=csv`}
                  onClick={() => setExportOpen(false)}
                >
                  <FileText size={14} aria-hidden />
                  CSV
                </a>
                <a
                  role="menuitem"
                  className="ssr-export__item"
                  href={`${view.exportBase}&format=xls`}
                  onClick={() => setExportOpen(false)}
                >
                  <FileSpreadsheet size={14} aria-hidden />
                  Excel (.xls)
                </a>
                <a
                  role="menuitem"
                  className="ssr-export__item"
                  href={`${view.exportBase}&format=pdf`}
                  onClick={() => setExportOpen(false)}
                >
                  <FileText size={14} aria-hidden />
                  PDF
                </a>
              </div>
            ) : null}
          </div>
          <Link className="ssr-btn ssr-btn--yellow" href={view.shiftsHref}>
            <List size={15} aria-hidden />
            View Shift Reports
          </Link>
        </div>
      </div>

      <div className="sms-toolbar">
        <div className="sms-toolbar__period">
          <label htmlFor="sms-period-day">Reporting Period</label>
          <div className="sms-seg" role="group" aria-label="Reporting period">
            {periods.map((p) => (
              <button
                key={p.key}
                id={p.key === "day" ? "sms-period-day" : undefined}
                type="button"
                className={view.period === p.key ? "is-active" : undefined}
                onClick={() => onPeriodChange(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sms-toolbar__date">
          <label htmlFor="sms-date">{view.period === "custom" ? "Date range" : "Date"}</label>
          {view.period === "custom" ? (
            <div className="sms-date-range">
              <span className="sms-date-pill">
                <CalendarDays size={15} aria-hidden />
                <input
                  type="date"
                  value={view.fromIso}
                  onChange={(e) => onCustomChange(e.target.value, view.toIso)}
                  aria-label="From date"
                />
              </span>
              <span aria-hidden>–</span>
              <span className="sms-date-pill">
                <CalendarDays size={15} aria-hidden />
                <input
                  type="date"
                  value={view.toIso}
                  onChange={(e) => onCustomChange(view.fromIso, e.target.value)}
                  aria-label="To date"
                />
              </span>
            </div>
          ) : (
            <span className="sms-date-pill">
              <CalendarDays size={15} aria-hidden />
              <input
                id="sms-date"
                type="date"
                value={view.dateIso}
                onChange={(e) => onDateChange(e.target.value)}
                aria-label="Reporting date"
              />
            </span>
          )}
        </div>
      </div>

      <div className="sms-kpis" aria-label="Monetary KPIs">
        <div className="sms-kpi sms-kpi--blue">
          <span className="sms-kpi__ico"><Wallet size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatKshCompact(view.totalRevenueKes)}</p>
            <p className="sms-kpi__label">Total Sales Revenue</p>
          </div>
        </div>
        <div className="sms-kpi sms-kpi--blue">
          <span className="sms-kpi__ico"><Fuel size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatKshCompact(view.pms.revenueKes)}</p>
            <p className="sms-kpi__label">PMS Revenue</p>
          </div>
        </div>
        <div className="sms-kpi sms-kpi--gold">
          <span className="sms-kpi__ico"><Fuel size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatKshCompact(view.ago.revenueKes)}</p>
            <p className="sms-kpi__label">AGO Revenue</p>
          </div>
        </div>
        <div className="sms-kpi sms-kpi--green">
          <span className="sms-kpi__ico"><Banknote size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatKshCompact(view.totalCollectionsKes)}</p>
            <p className="sms-kpi__label">Total Collections</p>
          </div>
        </div>
        <div className={`sms-kpi sms-kpi--${varTone}`}>
          <span className="sms-kpi__ico"><CheckCircle2 size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatKshSignedCompact(view.monetaryVarianceKes)}</p>
            <p className="sms-kpi__label">Monetary Variance</p>
          </div>
        </div>
        <div className="sms-kpi sms-kpi--red">
          <span className="sms-kpi__ico"><Target size={15} /></span>
          <div>
            <p className="sms-kpi__value">
              {view.dailyTargetKes == null ? "—" : formatKshCompact(view.dailyTargetKes)}
            </p>
            <p className="sms-kpi__label">
              {view.period === "day" ? "Daily Target" : "Period Target"}
            </p>
          </div>
        </div>
        <div className="sms-kpi sms-kpi--green">
          <span className="sms-kpi__ico"><Target size={15} /></span>
          <div>
            <p className="sms-kpi__value">{formatPctRound(view.targetAchievementPct)}</p>
            <p className="sms-kpi__label">Target Achievement</p>
          </div>
        </div>
      </div>

      <div className="sms-grid">
        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>Revenue & Collections Breakdown ({view.periodLabel})</h3>
          </header>
          <div className="ssr-table-wrap">
            <table className="ssr-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Sales Volume (L)</th>
                  <th className="num">Unit Price (KSh/L)</th>
                  <th className="num">Revenue (KSh)</th>
                </tr>
              </thead>
              <tbody>
                {[view.pms, view.ago].map((row) => (
                  <tr key={row.product}>
                    <td>
                      <span className={`ssr-pill ssr-pill--${row.product.toLowerCase()}`}>
                        {row.product}
                      </span>
                    </td>
                    <td className="num">{formatLitresCell(row.volumeLitres)}</td>
                    <td className="num">{priceLabel(row)}</td>
                    <td className="num">{formatKshCompact(row.revenueKes)}</td>
                  </tr>
                ))}
                <tr className="is-total">
                  <td>Total</td>
                  <td className="num">{formatLitresCell(view.totalVolume)}</td>
                  <td className="num">—</td>
                  <td className="num">{formatKshCompact(view.totalRevenueKes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="ssr-note">
            {view.reportsIncluded} CLOSED report{view.reportsIncluded === 1 ? "" : "s"} · revenue uses
            snapshotted shift prices (not today’s price).
          </p>
        </article>

        <article className="ssi-card sms-pay-card">
          <header className="ssi-card__head">
            <h3>Collections by Payment Method</h3>
          </header>
          <div className="sms-pay">
            <Donut slices={view.payments} total={view.totalCollectionsKes} />
            <ul className="sms-pay__legend">
              {view.payments.map((p) => (
                <li key={p.key}>
                  <span className="sms-pay__swatch" style={{ background: p.color }} aria-hidden />
                  <span className="sms-pay__name">{p.label}</span>
                  <span className="sms-pay__amt">{formatKshCompact(p.amountKes)}</span>
                  <span className="sms-pay__pct">{p.pct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <div className="sms-grid">
        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>Monetary Targets vs Actual</h3>
          </header>
          <div className="ssr-table-wrap">
            <table className="ssr-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Target (KSh)</th>
                  <th className="num">Actual (KSh)</th>
                  <th className="num">Variance (KSh)</th>
                  <th>Achievement</th>
                </tr>
              </thead>
              <tbody>
                {view.targetRows.map((row) => {
                  const width = Math.min(100, Math.max(0, row.achievementPct ?? 0));
                  return (
                    <tr key={row.product} className={row.product === "Total" ? "is-total" : undefined}>
                      <td>{row.product}</td>
                      <td className="num">
                        {row.targetKes == null ? "Not configured" : formatKshCompact(row.targetKes)}
                      </td>
                      <td className="num">{formatKshCompact(row.actualKes)}</td>
                      <td className="num">
                        {row.varianceKes == null ? (
                          "—"
                        ) : (
                          <span
                            className={`ssr-pill ${
                              row.varianceKes < -0.015
                                ? "ssr-pill--loss"
                                : row.varianceKes > 0.015
                                  ? "ssr-pill--gain"
                                  : "ssr-pill--zero"
                            }`}
                          >
                            {formatKshSignedCompact(row.varianceKes)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="sms-ach">
                          <div className="sms-ach__track">
                            <div className="sms-ach__bar" style={{ width: `${width}%` }} />
                          </div>
                          <span>{formatPctRound(row.achievementPct)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>Revenue Trend</h3>
            <div className="sms-trend__legend">
              <span><i style={{ background: "#3551a5" }} /> Actual Sales</span>
              <span><i style={{ background: "#ffcc00" }} /> Target</span>
            </div>
          </header>
          <TrendChart points={view.trend} />
          <p className="ssr-note">Grey stubs mark days without a CLOSED report (not treated as zero sales).</p>
        </article>
      </div>
    </section>
  );
}
