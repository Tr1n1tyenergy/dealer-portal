"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Fuel,
  Info,
  List,
  MapPin,
  Percent,
  Search,
  AlertTriangle,
} from "lucide-react";
import type {
  ProductReconRow,
  StaffReportingPeriod,
} from "@/lib/stock-reporting/staff-reconciliation";
import {
  formatLitresCell,
  formatSignedLitres,
  formatVariancePct,
} from "@/lib/stock-reporting/staff-reconciliation";
import {
  StaffStockIntelligencePanel,
  type StaffIntelligenceViewModel,
} from "@/components/staff/staff-stock-intelligence";
import {
  StaffMonetarySalesPanel,
  type StaffMonetaryViewModel,
} from "@/components/staff/staff-monetary-sales";
import type { PeriodKey } from "@/lib/stock-reporting/staff-stock-intelligence";
import "@/app/intelligence/retail/staff-stock-reporting.css";

export type StaffStationOption = {
  id: string;
  name: string;
  dealerName: string;
  hasClosedInPeriod: boolean;
  hasDraftInPeriod: boolean;
};

export type StaffReconViewModel = {
  section: "reconciliation" | "intelligence" | "monetary";
  stationId: string;
  stationName: string;
  dealerName: string;
  period: StaffReportingPeriod;
  dateIso: string;
  fromIso: string;
  toIso: string;
  periodLabel: string;
  completeness: { status: "complete" | "incomplete" | "pending" | "none"; label: string };
  expectedDays: number;
  closedDays: number;
  reportsIncluded: number;
  lastUpdatedLabel: string | null;
  lossReason: string | null;
  rows: ProductReconRow[];
  total: ProductReconRow;
  totalSales: number;
  netVariance: number;
  netVariancePct: number | null;
  receiptsRecorded: boolean;
  stations: StaffStationOption[];
  intelligence: StaffIntelligenceViewModel | null;
  monetary: StaffMonetaryViewModel | null;
};

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function varianceTone(v: number): "gain" | "loss" | "zero" {
  if (v > 0.0005) return "gain";
  if (v < -0.0005) return "loss";
  return "zero";
}

function ProductRow({ row }: { row: ProductReconRow }) {
  const tone = varianceTone(row.variance);
  return (
    <tr>
      <td>
        <span className={`ssr-pill ssr-pill--${row.product.toLowerCase()}`}>{row.product}</span>
      </td>
      <td className="num">{formatLitresCell(row.opening)}</td>
      <td className="num">{formatLitresCell(row.received)}</td>
      <td className="num">{formatLitresCell(row.available)}</td>
      <td className="num">{formatLitresCell(row.sales)}</td>
      <td className="num">{formatLitresCell(row.expectedClosing)}</td>
      <td className="num">{formatLitresCell(row.actualClosing)}</td>
      <td className="num">
        <span className={`ssr-pill ssr-pill--${tone}`}>{formatSignedLitres(row.variance)}</span>
      </td>
      <td className="num">
        <span className={`ssr-pill ssr-pill--${tone}`}>{formatVariancePct(row.variancePct)}</span>
      </td>
    </tr>
  );
}

export function StaffStockReconciliationDashboard(props: StaffReconViewModel) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredStations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.stations;
    return props.stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.dealerName.toLowerCase().includes(q)
    );
  }, [props.stations, query]);

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

  function navigate(patch: Record<string, string | null>) {
    startTransition(() => {
      router.push(buildHref(pathname, searchParams, patch));
    });
  }

  const periods: { key: StaffReportingPeriod; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "custom", label: "Custom Range" },
  ];

  const sectionQs = {
    station: props.stationId,
    period: props.period,
    date: props.dateIso,
    from: props.period === "custom" ? props.fromIso : null,
    to: props.period === "custom" ? props.toIso : null,
  };

  const netTone = varianceTone(props.netVariance);
  const netLabel =
    netTone === "gain" ? "Net Variance (Gain)" : netTone === "loss" ? "Net Variance (Shortage)" : "Net Variance";

  function exportHref(format: "csv" | "xls" | "pdf") {
    return `/api/intelligence/stock-reporting/export?${new URLSearchParams({
      station: props.stationId,
      period: props.period,
      date: props.dateIso,
      ...(props.period === "custom" ? { from: props.fromIso, to: props.toIso } : {}),
      format,
    }).toString()}`;
  }

  const shiftsHref = buildHref("/intelligence/retail/stock-reporting/shifts", searchParams, {
    station: props.stationId,
    period: props.period,
    date: props.dateIso,
    from: props.period === "custom" ? props.fromIso : null,
    to: props.period === "custom" ? props.toIso : null,
  });

  const explainHref = `${shiftsHref}#explanations`;

  const insights: { tone: "ok" | "warn" | "info"; text: string }[] = [];
  for (const row of props.rows) {
    if (props.reportsIncluded === 0) continue;
    const abs = Math.abs(row.variance);
    if (abs < 0.005) {
      insights.push({
        tone: "ok",
        text: `${row.product}: Balanced for the selected period.`,
      });
      continue;
    }
    const pct = formatVariancePct(row.variancePct);
    if (row.variance > 0) {
      insights.push({
        tone: "ok",
        text: `${row.product}: Gain of ${formatLitresCell(abs)} L (${pct.replace("+", "")}) — review readings / possible unrecorded receipts.`,
      });
    } else {
      insights.push({
        tone: "warn",
        text: `${row.product}: Shortage of ${formatLitresCell(abs)} L (${pct.replace("−", "")}) — review dealer explanation.`,
      });
    }
  }
  if (props.reportsIncluded > 0) {
    insights.push({
      tone: "info",
      text: `Net variance: ${formatSignedLitres(props.netVariance)} L (${formatVariancePct(props.netVariancePct)}) overall.`,
    });
  }
  if (!props.receiptsRecorded && props.reportsIncluded > 0) {
    insights.push({
      tone: "info",
      text: "Received / Purchases is 0 until dealer delivery receipts are linked to shift reports.",
    });
  }
  if (props.reportsIncluded === 0) {
    insights.push({
      tone: "info",
      text: "No CLOSED stock reports for this station and period yet.",
    });
  }

  return (
    <div className="ssr" aria-busy={pending}>
      <header className="ssr-hero" aria-label="Stock Sale Reporting hero">
        <div className="ssr-hero__text">
          <div className="ssr-hero__eyebrow">Stock Sale Reporting</div>
          <h1>Stock Sale Intelligence</h1>
          <p>
            {props.section === "intelligence"
              ? "Tank levels, sales targets, stock holding and sales projections for each station."
              : props.section === "monetary"
                ? "Revenue, collections, targets and performance analysis from dealer shift reports."
                : "Station stock reconciliation, inventory monitoring and sales performance from dealer shift reports."}
          </p>
        </div>
      </header>

      <div className="ssr-wrap">
        <nav className="ssr-sections" aria-label="Stock Sale Reporting sections">
          <Link
            href={buildHref(pathname, searchParams, { ...sectionQs, section: "reconciliation" })}
            className={`ssr-section${props.section === "reconciliation" ? " is-active" : ""}`}
          >
            <span className="ssr-section__ico" aria-hidden>
              <ClipboardList size={18} />
            </span>
            <span>
              <p className="ssr-section__title">Stock Reconciliation</p>
              <p className="ssr-section__sub">
                Daily, weekly, monthly or custom stock reports and variances.
              </p>
            </span>
          </Link>
          <Link
            href={buildHref(pathname, searchParams, { ...sectionQs, section: "intelligence" })}
            className={`ssr-section${props.section === "intelligence" ? " is-active" : ""}`}
          >
            <span className="ssr-section__ico" aria-hidden>
              <Fuel size={18} />
            </span>
            <span>
              <p className="ssr-section__title">Stock Intelligence</p>
              <p className="ssr-section__sub">
                Tank levels, sales targets, projections and replenishment alerts.
              </p>
            </span>
          </Link>
          <Link
            href={buildHref(pathname, searchParams, { ...sectionQs, section: "monetary" })}
            className={`ssr-section${props.section === "monetary" ? " is-active" : ""}`}
          >
            <span className="ssr-section__ico" aria-hidden>
              <BarChart3 size={18} />
            </span>
            <span>
              <p className="ssr-section__title">Monetary Sales</p>
              <p className="ssr-section__sub">
                Revenue, collections, targets and performance analysis.
              </p>
            </span>
          </Link>
        </nav>

        <div className="ssr-body">
            <aside className="ssr-stations" aria-label="Stations">
              <div className="ssr-stations__head">
                <MapPin size={16} aria-hidden />
                <h2>Stations</h2>
                <span className="ssr-stations__count">{props.stations.length}</span>
              </div>
              <div className="ssr-stations__search">
                <Search size={15} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search station..."
                  aria-label="Search station"
                />
              </div>
              {filteredStations.length === 0 ? (
                <p className="ssr-empty-inline">No stations match your search.</p>
              ) : (
                <ul className="ssr-station-list">
                  {filteredStations.map((s) => {
                    const dealer = s.dealerName?.trim() || "Unassigned dealer";
                    const label = `${s.name} · ${dealer}`;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={`ssr-station${s.id === props.stationId ? " is-active" : ""}`}
                          onClick={() => navigate({ station: s.id })}
                          title={label}
                        >
                          <span className="ssr-station__dot" aria-hidden />
                          <span className="ssr-station__label">
                            <span className="ssr-station__name">{s.name}</span>
                            <span className="ssr-station__dealer">
                              <span className="ssr-station__dealer-kicker">Dealer</span>
                              {dealer}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            {props.section === "intelligence" && props.intelligence ? (
              <StaffStockIntelligencePanel
                view={props.intelligence}
                stations={props.stations}
                onSalesPeriodChange={(period: PeriodKey) => navigate({ intelPeriod: period })}
                onRequestStation={(stationId) => navigate({ station: stationId })}
              />
            ) : null}

            {props.section === "monetary" && props.monetary ? (
              <StaffMonetarySalesPanel
                view={props.monetary}
                onPeriodChange={(period) => navigate({ period })}
                onDateChange={(iso) => navigate({ date: iso })}
                onCustomChange={(from, to) => navigate({ period: "custom", from, to })}
              />
            ) : null}

            {props.section === "reconciliation" ? (
            <section className="ssr-main" aria-label="Stock Reconciliation workspace">
              <div className="ssr-main__top">
                <div className="ssr-main__title-row">
                  <h2 className="ssr-main__title">
                    Stock Reconciliation — {props.stationName}
                  </h2>
                  <span className={`ssr-status ssr-status--${props.completeness.status}`}>
                    {props.completeness.label}
                  </span>
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
                          href={exportHref("csv")}
                          onClick={() => setExportOpen(false)}
                        >
                          <FileText size={14} aria-hidden />
                          CSV
                        </a>
                        <a
                          role="menuitem"
                          className="ssr-export__item"
                          href={exportHref("xls")}
                          onClick={() => setExportOpen(false)}
                        >
                          <FileSpreadsheet size={14} aria-hidden />
                          Excel (.xls)
                        </a>
                        <a
                          role="menuitem"
                          className="ssr-export__item"
                          href={exportHref("pdf")}
                          onClick={() => setExportOpen(false)}
                        >
                          <FileText size={14} aria-hidden />
                          PDF
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <Link className="ssr-btn ssr-btn--yellow" href={shiftsHref}>
                    <List size={15} aria-hidden />
                    View Shift Reports
                  </Link>
                </div>
              </div>
              <p className="ssr-main__sub">
                Consolidated stock position, sales and variance analysis for the selected period.
              </p>

              <div className="ssr-controls">
                <div className="ssr-period">
                  <label>Reporting Period</label>
                  <div className="ssr-period__row" role="group" aria-label="Reporting period">
                    {periods.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`ssr-chip${props.period === p.key ? " is-active" : ""}`}
                        onClick={() => navigate({ period: p.key })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ssr-date">
                  <label>{props.period === "custom" ? "Date range" : "Date"}</label>
                  {props.period === "custom" ? (
                    <div className="ssr-date-range">
                      <div className="ssr-date__field">
                        <input
                          type="date"
                          value={props.fromIso}
                          onChange={(e) => navigate({ from: e.target.value, period: "custom" })}
                          aria-label="From date"
                        />
                        <CalendarDays size={15} aria-hidden />
                      </div>
                      <span aria-hidden>–</span>
                      <div className="ssr-date__field">
                        <input
                          type="date"
                          value={props.toIso}
                          onChange={(e) => navigate({ to: e.target.value, period: "custom" })}
                          aria-label="To date"
                        />
                        <CalendarDays size={15} aria-hidden />
                      </div>
                    </div>
                  ) : (
                    <div className="ssr-date__field">
                      <input
                        type="date"
                        value={props.dateIso}
                        onChange={(e) => navigate({ date: e.target.value })}
                        aria-label="Reporting date"
                      />
                      <CalendarDays size={15} aria-hidden />
                    </div>
                  )}
                </div>

                <div className="ssr-kpis" aria-label="Reconciliation KPIs">
                  <div className="ssr-kpi ssr-kpi--blue">
                    <span className="ssr-kpi__ico" aria-hidden>
                      <Fuel size={15} color="#3551a5" />
                    </span>
                    <div>
                      <p className="ssr-kpi__value">{formatLitresCell(props.totalSales)} L</p>
                      <p className="ssr-kpi__label">Total Sales</p>
                    </div>
                  </div>
                  <div
                    className={`ssr-kpi ${
                      netTone === "loss" ? "ssr-kpi--red" : netTone === "gain" ? "ssr-kpi--green" : "ssr-kpi--blue"
                    }`}
                  >
                    <span className="ssr-kpi__ico" aria-hidden>
                      {netTone === "loss" ? (
                        <AlertTriangle size={15} color="#b91c1c" />
                      ) : (
                        <CheckCircle2 size={15} color={netTone === "gain" ? "#15803d" : "#3551a5"} />
                      )}
                    </span>
                    <div>
                      <p className="ssr-kpi__value">{formatSignedLitres(props.netVariance)} L</p>
                      <p className="ssr-kpi__label">{netLabel}</p>
                    </div>
                  </div>
                  <div className="ssr-kpi ssr-kpi--purple">
                    <span className="ssr-kpi__ico" aria-hidden>
                      <Percent size={15} color="#6d28d9" />
                    </span>
                    <div>
                      <p className="ssr-kpi__value">{formatVariancePct(props.netVariancePct)}</p>
                      <p className="ssr-kpi__label">Variance</p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="ssr-table-caption">
                Stock Reconciliation Summary ({props.periodLabel})
              </p>
              <div className="ssr-table-wrap">
                <table className="ssr-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Opening Stock (L)</th>
                      <th className="num">Received / Purchases (L)</th>
                      <th className="num">Stock Available for Sale (L)</th>
                      <th className="num">Cumulative Sales (L)</th>
                      <th className="num">Expected Closing Stock (L)</th>
                      <th className="num">Actual Closing Stock (L)</th>
                      <th className="num">Variance (L)</th>
                      <th className="num">Variance (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.rows.map((row) => (
                      <ProductRow key={row.product} row={row} />
                    ))}
                    <tr className="is-total">
                      <td>Total</td>
                      <td className="num">{formatLitresCell(props.total.opening)}</td>
                      <td className="num">{formatLitresCell(props.total.received)}</td>
                      <td className="num">{formatLitresCell(props.total.available)}</td>
                      <td className="num">{formatLitresCell(props.total.sales)}</td>
                      <td className="num">{formatLitresCell(props.total.expectedClosing)}</td>
                      <td className="num">{formatLitresCell(props.total.actualClosing)}</td>
                      <td className="num">
                        <span className={`ssr-pill ssr-pill--${netTone}`}>
                          {formatSignedLitres(props.total.variance)}
                        </span>
                      </td>
                      <td className="num">
                        <span className={`ssr-pill ssr-pill--${netTone}`}>
                          {formatVariancePct(props.total.variancePct)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="ssr-note">
                Completeness: {props.closedDays} of {props.expectedDays} expected daily report
                {props.expectedDays === 1 ? "" : "s"} CLOSED
                {props.receiptsRecorded
                  ? ""
                  : " · Received volumes await delivery-receipt integration"}
                .
              </p>

              <div className="ssr-panels">
                <article className="ssr-panel">
                  <header className="ssr-panel__head">
                    <Info size={15} aria-hidden />
                    <h3>Reconciliation Insights</h3>
                  </header>
                  {insights.map((ins, i) => (
                    <div key={i} className="ssr-insight">
                      <span className={`ssr-insight__ico ssr-insight__ico--${ins.tone}`} aria-hidden>
                        {ins.tone === "ok" ? (
                          <CheckCircle2 size={13} />
                        ) : ins.tone === "warn" ? (
                          <AlertTriangle size={13} />
                        ) : (
                          <Info size={13} />
                        )}
                      </span>
                      <span>{ins.text}</span>
                    </div>
                  ))}
                </article>

                <article className="ssr-panel">
                  <header className="ssr-panel__head">
                    <ClipboardList size={15} aria-hidden />
                    <h3>Report Details</h3>
                  </header>
                  <div className="ssr-detail">
                    <div className="ssr-detail__row">
                      <span className="ssr-detail__label">
                        <ClipboardList size={14} aria-hidden /> Reports Included
                      </span>
                      <span className="ssr-detail__value">
                        {props.reportsIncluded} report{props.reportsIncluded === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="ssr-detail__row">
                      <span className="ssr-detail__label">
                        <MapPin size={14} aria-hidden /> Submitted By
                      </span>
                      <span className="ssr-detail__value">{props.dealerName} (Dealer)</span>
                    </div>
                    <div className="ssr-detail__row">
                      <span className="ssr-detail__label">
                        <CalendarDays size={14} aria-hidden /> Last Updated
                      </span>
                      <span className="ssr-detail__value">{props.lastUpdatedLabel ?? "—"}</span>
                    </div>
                    <div className="ssr-detail__row">
                      <span className="ssr-detail__label">
                        <ExternalLink size={14} aria-hidden /> Variance Explanation
                      </span>
                      <span className="ssr-detail__value">
                        {props.lossReason || props.reportsIncluded > 0 ? (
                          <Link href={explainHref}>View Explanation</Link>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            </section>
            ) : null}
          </div>
      </div>
    </div>
  );
}
