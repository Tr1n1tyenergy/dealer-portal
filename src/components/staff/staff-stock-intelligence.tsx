"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Fuel,
  Info,
  Layers,
  MessageSquare,
  Percent,
  Save,
  Settings,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import type {
  HoldingStatus,
  IntelligenceConfigValues,
  PeriodKey,
  ProductCodeLite,
  ProductHoldingRow,
  ProjectionRow,
  ProjectionStatus,
  SalesPerfRow,
  TankLevelView,
} from "@/lib/stock-reporting/staff-stock-intelligence";
import {
  cascadeTargetsFromPeriodEdit,
  classifyHolding,
  EMPTY_INTELLIGENCE_CONFIG,
  formatCoverDays,
  formatPctRound,
  resolvedTargets,
} from "@/lib/stock-reporting/staff-stock-intelligence";
import { formatLitresCell } from "@/lib/stock-reporting/staff-reconciliation";

export type StaffIntelStationOption = {
  id: string;
  name: string;
  dealerName: string;
};

export type StaffIntelligenceViewModel = {
  stationId: string;
  stationName: string;
  dealerName: string;
  canEditTargets: boolean;
  canMessage: boolean;
  lastReportLabel: string | null;
  stockSnapshotStale: boolean;
  totalTanks: number;
  totalStock: number;
  todaySales: number;
  todaySalesProvisional: boolean;
  dailyTarget: number | null;
  targetAchievementPct: number | null;
  stockCoverDays: number | null;
  tanks: TankLevelView[];
  salesPerf: SalesPerfRow[];
  salesPeriod: PeriodKey;
  projections: ProjectionRow[];
  holdings: ProductHoldingRow[];
  forecast: {
    product: "PMS" | "AGO";
    avgDaily: number | null;
    status: ProjectionStatus;
    meetsWeekly: boolean | null;
    meetsMonthly: boolean | null;
    meetsYearly: boolean | null;
  }[];
  config: IntelligenceConfigValues;
  openOrdersInTransit: number;
};

type FocusSection = "targets" | "holdings";
type TargetPeriodFocus = PeriodKey;

function holdingClass(s: HoldingStatus) {
  if (s === "healthy") return "ssi-badge ssi-badge--ok";
  if (s === "warning") return "ssi-badge ssi-badge--warn";
  if (s === "critical") return "ssi-badge ssi-badge--crit";
  return "ssi-badge ssi-badge--muted";
}

function holdingLabel(s: HoldingStatus) {
  if (s === "healthy") return "Healthy";
  if (s === "warning") return "Warning";
  if (s === "critical") return "Critical";
  return "Insufficient Data";
}

function projIcon(s: ProjectionStatus) {
  if (s === "on_track") return <CheckCircle2 size={14} color="#15803d" />;
  if (s === "at_risk") return <AlertTriangle size={14} color="#b45309" />;
  if (s === "below") return <AlertTriangle size={14} color="#b91c1c" />;
  return <Info size={14} color="#64748b" />;
}

function configsEqual(a: IntelligenceConfigValues, b: IntelligenceConfigValues) {
  return (Object.keys(EMPTY_INTELLIGENCE_CONFIG) as (keyof IntelligenceConfigValues)[]).every(
    (k) => a[k] === b[k]
  );
}

function numInput(opts: {
  value: number | null;
  display?: number | null;
  onChange: (v: number | null) => void;
  emphasized?: boolean;
  ariaLabel: string;
  placeholder?: string;
}) {
  const shown = opts.value ?? opts.display ?? null;
  return (
    <input
      type="number"
      min={0}
      step="any"
      className={opts.emphasized ? "is-period-focus" : undefined}
      aria-label={opts.ariaLabel}
      placeholder={opts.placeholder}
      value={shown ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          opts.onChange(null);
          return;
        }
        const n = Number(raw);
        opts.onChange(Number.isFinite(n) && n >= 0 ? n : null);
      }}
    />
  );
}

function ProductBadge({ product }: { product: "PMS" | "AGO" }) {
  return (
    <span className={`ssi-modal__product ssi-modal__product--${product.toLowerCase()}`}>
      <Fuel size={13} aria-hidden />
      {product}
    </span>
  );
}

function AlertLevelPreview({ status }: { status: HoldingStatus | null }) {
  if (!status) {
    return (
      <span className="ssi-modal__alert-level ssi-modal__alert-level--muted" title="Status uses live stock for the selected station">
        —
      </span>
    );
  }
  const tone =
    status === "healthy"
      ? "ok"
      : status === "warning"
        ? "warn"
        : status === "critical"
          ? "crit"
          : "muted";
  return (
    <span
      className={`ssi-modal__alert-level ssi-modal__alert-level--${tone}`}
      title="Computed from current stock, average sales, and cover thresholds — not a saved label"
    >
      {holdingLabel(status)}
    </span>
  );
}

export function StaffStockIntelligencePanel({
  view,
  stations,
  onSalesPeriodChange,
  onRequestStation,
}: {
  view: StaffIntelligenceViewModel;
  stations: StaffIntelStationOption[];
  onSalesPeriodChange: (period: PeriodKey) => void;
  onRequestStation: (stationId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [cfg, setCfg] = useState<IntelligenceConfigValues>(view.config);
  const [baselineCfg, setBaselineCfg] = useState<IntelligenceConfigValues>(view.config);
  const [modalStationId, setModalStationId] = useState(view.stationId);
  const [focusSection, setFocusSection] = useState<FocusSection>("targets");
  const [focusPeriod, setFocusPeriod] = useState<TargetPeriodFocus>("day");
  const [loadingStation, setLoadingStation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const targetsPanelRef = useRef<HTMLElement | null>(null);
  const holdingsPanelRef = useRef<HTMLElement | null>(null);
  const dirty = useMemo(() => !configsEqual(cfg, baselineCfg), [cfg, baselineCfg]);
  const derived = useMemo(() => resolvedTargets(cfg), [cfg]);

  useEffect(() => {
    if (!modalOpen) {
      setCfg(view.config);
      setBaselineCfg(view.config);
      setModalStationId(view.stationId);
    }
  }, [view.config, view.stationId, modalOpen]);

  const replenishmentNotes = view.holdings
    .filter((h) => h.status === "warning" || h.status === "critical")
    .map((h) => {
      const cover = formatCoverDays(h.daysOfCover);
      if (h.status === "critical") {
        return `${h.product} is at ${cover} of cover (critical). Replenishment required.`;
      }
      return `${h.product} is at ${cover} of cover (approaching threshold). Consider placing a replenishment order soon.`;
    });

  function previewAlert(product: "PMS" | "AGO"): HoldingStatus | null {
    if (modalStationId !== view.stationId) return null;
    const row = view.holdings.find((h) => h.product === product);
    if (!row) return null;
    const min =
      product === "PMS" ? cfg.pmsMinHoldingLitres : cfg.agoMinHoldingLitres;
    const warn =
      product === "PMS" ? cfg.pmsWarningCoverDays : cfg.agoWarningCoverDays;
    const crit =
      product === "PMS" ? cfg.pmsCriticalCoverDays : cfg.agoCriticalCoverDays;
    return classifyHolding({
      stock: row.currentStock,
      daysOfCover: row.daysOfCover,
      minHolding: min,
      warningDays: warn,
      criticalDays: crit,
      hasSalesHistory: row.avgDailySales != null,
    });
  }

  function twoDayDisplay(product: "PMS" | "AGO"): number | null {
    const explicit =
      product === "PMS" ? cfg.pmsTwoDayHoldingLitres : cfg.agoTwoDayHoldingLitres;
    if (explicit != null) return null;
    const min =
      product === "PMS" ? cfg.pmsMinHoldingLitres : cfg.agoMinHoldingLitres;
    return min != null ? min * 2 : null;
  }

  function onTargetPeriodEdit(
    product: ProductCodeLite,
    period: PeriodKey,
    value: number | null
  ) {
    setCfg((prev) => cascadeTargetsFromPeriodEdit(prev, product, period, value));
  }

  function targetFieldValue(product: ProductCodeLite, period: PeriodKey): number | null {
    const row = product === "PMS" ? derived.pms : derived.ago;
    return row[period];
  }

  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm("Discard unsaved target and threshold changes?");
  }

  function closeModal() {
    if (!confirmDiscard()) return;
    setModalOpen(false);
    setSaveError(null);
  }

  function focusPanel(section: FocusSection) {
    setFocusSection(section);
    const el = section === "targets" ? targetsPanelRef.current : holdingsPanelRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function loadStationConfig(stationId: string) {
    setLoadingStation(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/intelligence/stock-reporting/targets?station=${encodeURIComponent(stationId)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Could not load station configuration.");
        return;
      }
      const next = (data.config ?? EMPTY_INTELLIGENCE_CONFIG) as IntelligenceConfigValues;
      setCfg(next);
      setBaselineCfg(next);
      setModalStationId(stationId);
    } finally {
      setLoadingStation(false);
    }
  }

  async function onModalStationChange(stationId: string) {
    if (stationId === modalStationId) return;
    if (!confirmDiscard()) return;
    await loadStationConfig(stationId);
  }

  async function contactDealer() {
    setContactError(null);
    const res = await fetch("/api/intelligence/stock-reporting/contact-dealer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: view.stationId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setContactError(data.error || "Could not open dealer conversation.");
      return;
    }
    router.push(data.href || "/intelligence/retail/messaging");
  }

  async function saveConfig() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/intelligence/stock-reporting/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: modalStationId, ...cfg }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || "Save failed.");
      return;
    }
    setBaselineCfg(cfg);
    setModalOpen(false);
    if (modalStationId !== view.stationId) {
      onRequestStation(modalStationId);
    } else {
      startTransition(() => router.refresh());
    }
  }

  const coverTone =
    view.stockCoverDays != null && view.stockCoverDays <= 1
      ? "ssi-kpi--warn"
      : view.stockCoverDays != null && view.stockCoverDays <= 3
        ? "ssi-kpi--warn"
        : "ssi-kpi--blue";

  const modalStationLabel =
    stations.find((s) => s.id === modalStationId)?.name ?? view.stationName;

  return (
    <section className="ssr-main" aria-label="Stock Intelligence workspace" aria-busy={pending}>
      <div className="ssr-main__top">
        <div>
          <div className="ssr-main__title-row">
            <h2 className="ssr-main__title">Stock Intelligence — {view.stationName}</h2>
            <span className="ssr-status ssr-status--complete">Active</span>
          </div>
          <p className="ssr-main__sub">
            Tank inventory, sales performance, targets, projections and stock holding status.
          </p>
        </div>
        <div className="ssr-actions">
          {view.canEditTargets ? (
            <button
              type="button"
              className="ssr-btn ssr-btn--outline"
              onClick={() => {
                setCfg(view.config);
                setBaselineCfg(view.config);
                setModalStationId(view.stationId);
                setFocusSection("targets");
                setFocusPeriod("day");
                setSaveError(null);
                setModalOpen(true);
              }}
            >
              <Settings size={15} aria-hidden />
              Set Targets & Thresholds
            </button>
          ) : null}
          {view.canMessage ? (
            <button type="button" className="ssr-btn ssr-btn--yellow" onClick={() => void contactDealer()}>
              <MessageSquare size={15} aria-hidden />
              Contact Dealer
            </button>
          ) : null}
        </div>
      </div>
      {contactError ? <p className="ssr-note" style={{ color: "#b91c1c" }}>{contactError}</p> : null}

      <div className="ssi-kpis" aria-label="Stock Intelligence KPIs">
        <div className="ssi-kpi ssi-kpi--blue">
          <span className="ssi-kpi__ico"><Layers size={15} /></span>
          <div>
            <p className="ssi-kpi__value">{view.totalTanks}</p>
            <p className="ssi-kpi__label">Total Tanks</p>
          </div>
        </div>
        <div className="ssi-kpi ssi-kpi--blue">
          <span className="ssi-kpi__ico"><Fuel size={15} /></span>
          <div>
            <p className="ssi-kpi__value">{formatLitresCell(view.totalStock)} L</p>
            <p className="ssi-kpi__label">Total Stock</p>
          </div>
        </div>
        <div className="ssi-kpi ssi-kpi--blue">
          <span className="ssi-kpi__ico"><BarChart3 size={15} /></span>
          <div>
            <p className="ssi-kpi__value">{formatLitresCell(view.todaySales)} L</p>
            <p className="ssi-kpi__label">
              Today&apos;s Sales{view.todaySalesProvisional ? " (provisional)" : ""}
            </p>
          </div>
        </div>
        <div className="ssi-kpi ssi-kpi--blue">
          <span className="ssi-kpi__ico"><Target size={15} /></span>
          <div>
            <p className="ssi-kpi__value">
              {view.dailyTarget == null ? "—" : `${formatLitresCell(view.dailyTarget)} L`}
            </p>
            <p className="ssi-kpi__label">Daily Target</p>
          </div>
        </div>
        <div className="ssi-kpi ssi-kpi--purple">
          <span className="ssi-kpi__ico"><Percent size={15} /></span>
          <div>
            <p className="ssi-kpi__value">{formatPctRound(view.targetAchievementPct)}</p>
            <p className="ssi-kpi__label">Target Achievement</p>
          </div>
        </div>
        <div className={`ssi-kpi ${coverTone}`}>
          <span className="ssi-kpi__ico"><AlertTriangle size={15} /></span>
          <div>
            <p className="ssi-kpi__value">{formatCoverDays(view.stockCoverDays)}</p>
            <p className="ssi-kpi__label">Stock Cover</p>
          </div>
        </div>
      </div>

      <div className="ssi-grid ssi-grid--tanks-sales">
        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>Tank Levels</h3>
            <span className="ssi-card__meta">
              Last Report: {view.lastReportLabel ?? "No verified reading"}
            </span>
          </header>
          {view.stockSnapshotStale ? (
            <p className="ssi-stale">Tank stock snapshot may be stale — latest verified reading is older than 36 hours.</p>
          ) : null}
          {view.tanks.length === 0 ? (
            <p className="ssr-empty-inline">No configured tanks for this station.</p>
          ) : (
            <div className="ssi-tanks">
              {view.tanks.map((t) => (
                <div key={t.id} className={`ssi-tank ssi-tank--${t.product.toLowerCase()}`}>
                  <div className="ssi-tank__name">
                    <span className={`ssi-tank__product ssi-tank__product--${t.product.toLowerCase()}`}>
                      {t.product}
                    </span>
                    <span>{t.label.replace(/^(PMS|AGO)\s*/i, "") || t.label}</span>
                  </div>
                  <div className="ssi-tank__visual" aria-hidden>
                    <span className="ssi-tank__cap" />
                    <div className={`ssi-tank__shell ssi-tank__shell--${t.product.toLowerCase()}`}>
                      <div
                        className="ssi-tank__fill"
                        style={{ height: `${Math.max(0, Math.min(100, t.fillPct))}%` }}
                      >
                        <span className="ssi-tank__meniscus" />
                      </div>
                      <span className="ssi-tank__gloss" />
                      <span className="ssi-tank__pct">{Math.round(t.fillPct)}%</span>
                    </div>
                    <span className="ssi-tank__base" />
                  </div>
                  <div className="ssi-tank__vol">
                    <strong>{formatLitresCell(t.currentLitres)} L</strong>
                    <span>of {formatLitresCell(t.capacityLitres)} L</span>
                  </div>
                  {t.overCapacity ? (
                    <div className="ssi-tank__warn">Reading exceeds capacity</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>Sales Performance (Volume)</h3>
            <div className="ssr-period__row" role="group" aria-label="Sales period">
              {(["day", "week", "month", "year"] as PeriodKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ssr-chip${view.salesPeriod === p ? " is-active" : ""}`}
                  onClick={() => onSalesPeriodChange(p)}
                >
                  {p[0]!.toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </header>
          <div className="ssi-perf">
            {view.salesPerf.map((row) => {
              const pct = row.achievementPct ?? 0;
              const width = Math.min(100, Math.max(0, pct));
              return (
                <div key={row.product} className="ssi-perf__row">
                  <span
                    className={`ssi-perf__pill ssi-perf__pill--${row.product.toLowerCase()}`}
                    title={row.provisional ? "Provisional" : undefined}
                  >
                    <Fuel size={14} aria-hidden />
                    {row.product}
                  </span>
                  <div className="ssi-perf__body">
                    <div className="ssi-perf__meta">
                      <span>
                        {formatLitresCell(row.actual)} L /{" "}
                        {row.target == null ? "—" : `${formatLitresCell(row.target)} L`}
                      </span>
                      <span className="ssi-perf__pct">{formatPctRound(row.achievementPct)}</span>
                    </div>
                    <div className="ssi-perf__track" aria-hidden>
                      <div
                        className={`ssi-perf__bar ssi-perf__bar--${row.product.toLowerCase()}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <article className="ssi-card ssi-card--projections">
        <header className="ssi-card__head">
          <h3>
            Targets & Projections{" "}
            <span title="Projections use recent average daily sales × remaining days in the period.">
              <Info size={14} aria-hidden />
            </span>
          </h3>
        </header>
        <div className="ssr-table-wrap ssi-projections-table">
          <table className="ssr-table">
            <thead>
              <tr>
                <th>Reporting Period</th>
                <th className="num">Target</th>
                <th className="num">Actual / To Date</th>
                <th className="num">Projection</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {view.projections.map((r) => (
                <tr key={r.period}>
                  <td>{r.label}</td>
                  <td className="num">{r.target == null ? "Not configured" : `${formatLitresCell(r.target)} L`}</td>
                  <td className="num">{formatLitresCell(r.actualToDate)} L</td>
                  <td className="num">{r.projection == null ? "—" : `${formatLitresCell(r.projection)} L`}</td>
                  <td>{projIcon(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="ssi-grid ssi-grid--bottom">
        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>
              Stock Holding & Replenishment <Info size={14} aria-hidden />
            </h3>
          </header>
          <div className="ssr-table-wrap">
            <table className="ssr-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Current Stock (L)</th>
                  <th className="num">Avg. Daily Sales (L)</th>
                  <th className="num">Days of Cover</th>
                  <th className="num">Min. Daily Holding (L)</th>
                  <th className="num">2-Day Holding (L)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {view.holdings.map((h) => (
                  <tr key={h.product}>
                    <td>
                      <span className={`ssr-pill ssr-pill--${h.product.toLowerCase()}`}>{h.product}</span>
                    </td>
                    <td className="num">{formatLitresCell(h.currentStock)}</td>
                    <td className="num">{h.avgDailySales == null ? "—" : formatLitresCell(h.avgDailySales)}</td>
                    <td className="num">{h.daysOfCover == null ? "—" : h.daysOfCover.toFixed(1)}</td>
                    <td className="num">{h.minHolding == null ? "—" : formatLitresCell(h.minHolding)}</td>
                    <td className="num">{h.twoDayHolding == null ? "—" : formatLitresCell(h.twoDayHolding)}</td>
                    <td>
                      <span className={holdingClass(h.status)}>{holdingLabel(h.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`ssi-alert${replenishmentNotes.length ? "" : " ssi-alert--ok"}`}>
            {replenishmentNotes.length
              ? replenishmentNotes.join(" ")
              : "Stock holding is within configured thresholds for the selected station."}
            {view.openOrdersInTransit > 0
              ? ` ${view.openOrdersInTransit} replenishment order(s) in transit are not counted as physical stock.`
              : ""}
          </div>
        </article>

        <article className="ssi-card">
          <header className="ssi-card__head">
            <h3>
              Sales Forecast & Target Outlook <Info size={14} aria-hidden />
            </h3>
          </header>
          <div className="ssi-forecast">
            {view.forecast.map((f) => (
              <div key={f.product} className="ssi-forecast__block">
                <div className="ssi-forecast__head">
                  <Fuel size={16} aria-hidden />
                  <strong>{f.product}</strong>
                  <TrendingUp size={14} aria-hidden />
                  <span className={holdingClass(f.status === "on_track" ? "healthy" : f.status === "at_risk" ? "warning" : f.status === "below" ? "critical" : "insufficient")}>
                    {f.status === "on_track"
                      ? "On Track"
                      : f.status === "at_risk"
                        ? "At Risk"
                        : f.status === "below"
                          ? "Below Target"
                          : "Insufficient Data"}
                  </span>
                </div>
                <p>
                  {f.avgDaily == null
                    ? "Insufficient sales history to forecast."
                    : `At current rate (${formatLitresCell(f.avgDaily)} L/day), you will meet:`}
                </p>
                {f.avgDaily != null ? (
                  <ul>
                    <li className={f.meetsWeekly ? "is-yes" : "is-no"}>Weekly target</li>
                    <li className={f.meetsMonthly ? "is-yes" : "is-no"}>Monthly target</li>
                    <li className={f.meetsYearly ? "is-yes" : "is-no"}>Yearly target</li>
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </div>

      {modalOpen ? (
        <div
          className="ssi-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ssi-targets-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeModal();
            }
          }}
        >
          <div className="ssi-modal__card">
            <header className="ssi-modal__head">
              <span className="ssi-modal__ico" aria-hidden>
                <Settings size={18} />
              </span>
              <div className="ssi-modal__titles">
                <h2 id="ssi-targets-title">Set Sales Targets & Stock Thresholds</h2>
                <p>
                  Configure daily, weekly, monthly and yearly targets for stock sales and minimum
                  stock holding thresholds.
                </p>
              </div>
              <button type="button" className="ssi-modal__close" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="ssi-modal__nav" role="tablist" aria-label="Configuration sections">
              <button
                type="button"
                role="tab"
                aria-selected={focusSection === "targets"}
                className={`ssi-modal__nav-btn${focusSection === "targets" ? " is-active" : ""}`}
                onClick={() => focusPanel("targets")}
              >
                <Target size={16} aria-hidden />
                Stock Sale Targets
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={focusSection === "holdings"}
                className={`ssi-modal__nav-btn${focusSection === "holdings" ? " is-active" : ""}`}
                onClick={() => focusPanel("holdings")}
              >
                <Layers size={16} aria-hidden />
                Stock Holding Thresholds
              </button>
            </div>

            <div className="ssi-modal__selectors">
              <label className="ssi-modal__field ssi-modal__field--station">
                <span>Station</span>
                <span className="ssi-modal__select-wrap">
                  <Building2 size={15} aria-hidden />
                  <select
                    value={modalStationId}
                    disabled={loadingStation || saving}
                    onChange={(e) => void onModalStationChange(e.target.value)}
                    aria-label="Station"
                  >
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <div className="ssi-modal__field ssi-modal__field--period">
                <span id="ssi-target-period-label">Target Period</span>
                <div
                  className="ssi-modal__period"
                  role="group"
                  aria-labelledby="ssi-target-period-label"
                >
                  {(
                    [
                      ["day", "Daily"],
                      ["week", "Weekly"],
                      ["month", "Monthly"],
                      ["year", "Yearly"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={focusPeriod === key ? "is-active" : undefined}
                      onClick={() => setFocusPeriod(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`ssi-modal__grid${loadingStation ? " is-loading" : ""}`}>
              <section
                ref={targetsPanelRef}
                className={`ssi-modal__panel${focusSection === "targets" ? " is-focused" : ""}`}
                aria-label="Stock Sale Targets"
              >
                <header className="ssi-modal__panel-head">
                  <h3>
                    <BarChart3 size={16} aria-hidden /> Stock Sale Targets
                  </h3>
                  <p>
                    Set the expected daily sales volume for each product. These targets will be used
                    for performance tracking and forecasting.
                  </p>
                </header>

                <div className="ssi-modal__table-wrap">
                  <table className="ssi-modal__table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className={`num${focusPeriod === "day" ? " is-period-focus" : ""}`}>
                          Daily Target (L)
                        </th>
                        <th className={`num${focusPeriod === "week" ? " is-period-focus" : ""}`}>
                          Weekly Target (L)
                        </th>
                        <th className={`num${focusPeriod === "month" ? " is-period-focus" : ""}`}>
                          Monthly Target (L)
                        </th>
                        <th className={`num${focusPeriod === "year" ? " is-period-focus" : ""}`}>
                          Yearly Target (L)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["PMS", "AGO"] as const).map((product) => (
                        <tr key={product}>
                          <td>
                            <ProductBadge product={product} />
                          </td>
                          {(
                            [
                              ["day", "daily"],
                              ["week", "weekly"],
                              ["month", "monthly"],
                              ["year", "yearly"],
                            ] as const
                          ).map(([period, label]) => (
                            <td key={period} className="num">
                              {numInput({
                                value: targetFieldValue(product, period),
                                emphasized: focusPeriod === period,
                                ariaLabel: `${product} ${label} target litres`,
                                onChange: (v) => onTargetPeriodEdit(product, period, v),
                              })}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <aside className="ssi-modal__info ssi-modal__info--yellow">
                  <Target size={14} aria-hidden />
                  <div>
                    <strong>Auto-calculation</strong>
                    <p>
                      Edit any period field and the others update from a daily rate (÷7 / ÷30 /
                      ÷365). Monthly performance comparisons use the actual days in that month.
                    </p>
                  </div>
                </aside>
              </section>

              <section
                ref={holdingsPanelRef}
                className={`ssi-modal__panel${focusSection === "holdings" ? " is-focused" : ""}`}
                aria-label="Stock Holding Thresholds"
              >
                <header className="ssi-modal__panel-head">
                  <h3>
                    <Layers size={16} aria-hidden /> Stock Holding Thresholds
                  </h3>
                  <p>
                    Set the minimum stock holding levels to ensure each station maintains at least 2
                    days of stock.
                  </p>
                </header>

                <div className="ssi-modal__table-wrap">
                  <table className="ssi-modal__table ssi-modal__table--holdings">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Minimum Daily Holding (L)</th>
                        <th className="num">2-Day Holding (L)</th>
                        <th>Alert Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["PMS", "AGO"] as const).map((product) => {
                        const minKey =
                          product === "PMS" ? "pmsMinHoldingLitres" : "agoMinHoldingLitres";
                        const twoKey =
                          product === "PMS" ? "pmsTwoDayHoldingLitres" : "agoTwoDayHoldingLitres";
                        return (
                          <tr key={product}>
                            <td>
                              <ProductBadge product={product} />
                            </td>
                            <td className="num">
                              {numInput({
                                value: cfg[minKey],
                                ariaLabel: `${product} minimum daily holding litres`,
                                onChange: (v) => {
                                  const prevMin = cfg[minKey];
                                  const prevTwo = cfg[twoKey];
                                  const wasDerived =
                                    prevTwo == null ||
                                    (prevMin != null &&
                                      Math.abs(prevTwo - prevMin * 2) < 0.0005);
                                  setCfg({
                                    ...cfg,
                                    [minKey]: v,
                                    [twoKey]: wasDerived && v != null ? null : cfg[twoKey],
                                  });
                                },
                              })}
                            </td>
                            <td className="num">
                              {numInput({
                                value: cfg[twoKey],
                                display: twoDayDisplay(product),
                                ariaLabel: `${product} two-day holding litres`,
                                onChange: (v) => setCfg({ ...cfg, [twoKey]: v }),
                              })}
                            </td>
                            <td>
                              <AlertLevelPreview status={previewAlert(product)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <aside className="ssi-modal__info ssi-modal__info--blue">
                  <Info size={14} aria-hidden />
                  <div>
                    <strong>How it works</strong>
                    <ul>
                      <li>If stock drops below the 2-day holding level, the station is flagged.</li>
                      <li>Alerts help identify stations that need urgent replenishment.</li>
                      <li>Thresholds can be adjusted at any time.</li>
                    </ul>
                  </div>
                </aside>
              </section>
            </div>

            {saveError ? (
              <p className="ssi-modal__error" role="alert">
                {saveError}
              </p>
            ) : null}

            <footer className="ssi-modal__foot">
              <button type="button" className="ssi-modal__btn ssi-modal__btn--cancel" onClick={closeModal}>
                <X size={14} aria-hidden /> Cancel
              </button>
              <button
                type="button"
                className="ssi-modal__btn ssi-modal__btn--save"
                disabled={saving || loadingStation}
                onClick={() => void saveConfig()}
              >
                <Save size={15} aria-hidden />
                {saving ? "Saving…" : "Save Targets & Thresholds"}
              </button>
            </footer>
            <p className="ssi-modal__station-hint" aria-live="polite">
              Editing configuration for <strong>{modalStationLabel}</strong>
              {dirty ? " · unsaved changes" : ""}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
