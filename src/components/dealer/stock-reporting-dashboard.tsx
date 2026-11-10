"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Eye,
  Fuel,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Truck,
} from "lucide-react";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import {
  continueStockReportAction,
  resetTodaysStockReportAction,
  startTodaysStockReportAction,
} from "@/lib/stock-reporting/actions";
import {
  STOCK_REPORTING_MODULE_NAV,
  type StockReportingModuleKey,
} from "@/lib/stock-reporting/constants";
import type { StageProgressRow } from "@/lib/stock-reporting/progress";
import { cn } from "@/lib/utils";
import { DealerHeroActions } from "./dealer-hero-actions";
import "@/app/dealer/dealer-stock-reporting.css";
/** Reuse the proven Order Progress tracker styles (same as Dealer Dashboard). */
import "@/app/dealer/dealer-dashboard.css";

export type StockRecentReportRow = {
  id: string;
  reportingDateLabel: string;
  meterSales: string;
  tankSales: string;
  totalSales: string;
  expectedRevenue: string;
  collections: string;
  status: "Closed";
};

export type StockReportingDashboardProps = {
  module: StockReportingModuleKey;
  stationName: string;
  stationId: string;
  reportingDateLabel: string;
  pumpsTanksLabel: string;
  productsLabel: string;
  reportStatus: "not_started" | "in_progress" | "closed";
  stages: StageProgressRow[];
  todaysReportId: string | null;
  todaysRevision: number | null;
  recentReports: StockRecentReportRow[];
  loadError?: string | null;
};

function moduleIcon(key: StockReportingModuleKey) {
  if (key === "records") return <Clock3 size={18} strokeWidth={2} aria-hidden />;
  if (key === "rtt") return <Truck size={18} strokeWidth={2} aria-hidden />;
  return <ClipboardList size={18} strokeWidth={2} aria-hidden />;
}

function summaryIcon(kind: "station" | "date" | "pumps" | "products") {
  if (kind === "station") return <Building2 size={18} strokeWidth={2} aria-hidden />;
  if (kind === "date") return <CalendarDays size={18} strokeWidth={2} aria-hidden />;
  if (kind === "pumps") return <Layers size={18} strokeWidth={2} aria-hidden />;
  return <Fuel size={18} strokeWidth={2} aria-hidden />;
}

function statusBadge(status: StockReportingDashboardProps["reportStatus"]) {
  if (status === "closed") {
    return (
      <span className="ssr__status ssr__status--closed">
        <Check size={13} strokeWidth={2.5} aria-hidden />
        Closed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="ssr__status ssr__status--progress">
        <Loader2 size={13} strokeWidth={2.5} aria-hidden />
        In progress
      </span>
    );
  }
  return (
    <span className="ssr__status ssr__status--idle">
      <ClipboardList size={13} strokeWidth={2.5} aria-hidden />
      Not started
    </span>
  );
}

export function StockReportingDashboard(props: StockReportingDashboardProps) {
  const router = useRouter();
  const infoId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const continueHref =
    props.reportStatus === "closed" && props.todaysReportId
      ? `/dealer/stock-reporting/report/${props.todaysReportId}`
      : props.stages.find((s) => s.state === "current")?.href ??
        "/dealer/stock-reporting/pump-meters";

  function runAction(kind: "start" | "continue" | "reset") {
    setError(null);
    startTransition(async () => {
      let result;
      if (kind === "reset") {
        if (!props.todaysReportId || props.todaysRevision == null) {
          setError("No draft report is available to reset.");
          setConfirmReset(false);
          return;
        }
        result = await resetTodaysStockReportAction({
          reportId: props.todaysReportId,
          expectedRevision: props.todaysRevision,
        });
      } else if (kind === "start") {
        result = await startTodaysStockReportAction(props.stationId);
      } else {
        result = await continueStockReportAction(props.stationId);
      }
      setConfirmReset(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="ssr">
      <section
        className="ssr__hero"
        style={dealerHeroPhotoStyle}
        aria-label="Stock Sale Reporting"
      >
        <div className="ssr__hero-veil" aria-hidden />
        <div className="ssr__hero-inner">
          <div className="ssr__hero-copy">
            <span className="ssr__hero-accent" aria-hidden />
            <div>
              <p className="ssr__hero-kicker">Dealer Portal</p>
              <h1>Stock Sale Reporting</h1>
              <p>Record daily pump readings, tank dips, reconcile stock and monetary sales.</p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <div className="ssr__body">
        <aside className="ssr__nav" aria-label="Stock Sale Reporting modules">
          <ul className="ssr__nav-list">
            {STOCK_REPORTING_MODULE_NAV.map((item) => {
              const active = item.key === props.module;
              return (
                <li key={item.key} className="ssr__nav-item">
                  <Link
                    href={item.href}
                    className={cn("ssr__nav-link", active && "is-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    {moduleIcon(item.key)}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="ssr__main">
          {(error || props.loadError) && (
            <p className="ssr__error" role="alert">
              {error || props.loadError}
            </p>
          )}

          <section className="ssr__summary" aria-label="Station summary">
            {(
              [
                ["station", "Station", props.stationName],
                ["date", "Today's Report", props.reportingDateLabel],
                ["pumps", "Pumps / Tanks", props.pumpsTanksLabel],
                ["products", "Products", props.productsLabel],
              ] as const
            ).map(([kind, label, value]) => (
              <article key={kind} className="ssr__summary-card">
                <div className="ssr__summary-inner">
                  <span className="ssr__summary-icon">{summaryIcon(kind)}</span>
                  <div>
                    <p className="ssr__summary-label">{label}</p>
                    <p className="ssr__summary-value">{value}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <div className="ssr__mid">
            <section className="ssr__card" aria-labelledby="ssr-today-title">
              <div className="ssr__card-head">
                <div className="ssr__card-title-row">
                  <span className="ssr__card-icon">
                    <ClipboardList size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <h2 id="ssr-today-title" className="ssr__card-title">
                      Today&apos;s stock report
                    </h2>
                    <p className="ssr__card-sub">
                      {props.reportStatus === "not_started"
                        ? "Start your daily report for this station."
                        : props.reportStatus === "closed"
                          ? "Today's report is closed. You can view the saved record."
                          : "Continue your daily report from where you left off."}
                    </p>
                  </div>
                </div>
                {statusBadge(props.reportStatus)}
              </div>

              {/* Same progress rail as Dealer Dashboard order tracker (.dd__progress). */}
              <div className="dd" style={{ padding: 0, background: "transparent", minHeight: 0 }}>
                <ol className="dd__progress" aria-label="Reporting progress">
                  {props.stages.map((stage, index) => {
                    const next = props.stages[index + 1];
                    const connectorClass =
                      stage.state === "done"
                        ? next && next.state !== "done"
                          ? "is-active"
                          : "is-done"
                        : "";
                    const stepState =
                      stage.state === "done"
                        ? "done"
                        : stage.state === "current"
                          ? "active"
                          : "pending";
                    return (
                      <li
                        key={stage.id}
                        className={cn("dd__progress-step", `is-${stepState}`)}
                        aria-current={stage.state === "current" ? "step" : undefined}
                      >
                        <div className="dd__progress-rail">
                          <div className="dd__progress-node">
                            <span className="dd__progress-dot" aria-hidden>
                              {stage.state === "done" ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                stage.stepNumber
                              )}
                            </span>
                            <span className="dd__progress-label">{stage.label}</span>
                            <small className="dd__progress-note">{stage.statusLabel}</small>
                          </div>
                          {index < props.stages.length - 1 ? (
                            <span
                              className={cn("dd__progress-line", connectorClass)}
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="ssr__actions">
                {props.reportStatus === "not_started" ? (
                  <button
                    type="button"
                    className="ssr__btn ssr__btn--primary"
                    disabled={pending || !props.stationId}
                    onClick={() => runAction("start")}
                  >
                    {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                    Start Today&apos;s Report
                    <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                ) : props.reportStatus === "closed" ? (
                  <Link href={continueHref} className="ssr__btn ssr__btn--primary">
                    View report
                    <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="ssr__btn ssr__btn--primary"
                    disabled={pending}
                    onClick={() => runAction("continue")}
                  >
                    {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                    Continue Report
                    <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                )}

                <button
                  type="button"
                  className="ssr__btn ssr__btn--ghost"
                  disabled={
                    pending ||
                    props.reportStatus === "not_started" ||
                    props.reportStatus === "closed" ||
                    !props.todaysReportId
                  }
                  onClick={() => setConfirmReset(true)}
                  title={
                    props.reportStatus === "closed"
                      ? "Closed reports cannot be reset from here"
                      : undefined
                  }
                >
                  <RefreshCw size={15} strokeWidth={2.25} aria-hidden />
                  Start over
                </button>
              </div>

            </section>

            <section className="ssr__card" aria-labelledby="ssr-process-title">
              <div className="ssr__card-head">
                <div className="ssr__card-title-row">
                  <span className="ssr__card-icon">
                    <Layers size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <h2 id="ssr-process-title" className="ssr__card-title">
                      Reporting process
                    </h2>
                    <p className="ssr__card-sub">A quick guide to daily stock sale reporting.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="ssr__info-btn"
                  aria-expanded={infoOpen}
                  aria-controls={infoId}
                  aria-label="About the reporting process"
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  <Info size={16} strokeWidth={2.25} aria-hidden />
                </button>
              </div>

              {infoOpen ? (
                <div id={infoId} className="ssr__info-pop" role="note">
                  Complete each stage in order. A stage is marked complete only after its readings
                  are validated and saved. Closed reports stay read-only unless an authorized
                  correction process is used.
                </div>
              ) : null}

              <ol className="ssr__process-list">
                {[
                  "Record pump meter readings (PMS & AGO)",
                  "Enter tank dip (stock) readings",
                  "Reconcile stock sales (meter vs. tank) and match any deliveries",
                  "Reconcile monetary sales (cash, M-Pesa & Visa) and close the shift",
                ].map((text, i) => (
                  <li key={text} className="ssr__process-item">
                    <span className="ssr__process-num" aria-hidden>
                      {i + 1}
                    </span>
                    <p className="ssr__process-text">{text}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="ssr__card" aria-labelledby="ssr-recent-title">
            <div className="ssr__recent-head">
              <div>
                <h2 id="ssr-recent-title" className="ssr__card-title">
                  Recent reports
                </h2>
                <p className="ssr__card-sub">View and track your past daily reports.</p>
              </div>
              <Link href="/dealer/stock-reporting/records" className="ssr__recent-link">
                View All Reports →
              </Link>
            </div>

            {props.recentReports.length === 0 ? (
              <div className="ssr__empty">
                <strong>No closed reports yet</strong>
                Complete and close a daily stock sale report to see it listed here.
              </div>
            ) : (
              <div className="ssr__table-wrap">
                <table className="ssr__table">
                  <thead>
                    <tr>
                      <th scope="col">Reporting date</th>
                      <th scope="col">Meter sales (L)</th>
                      <th scope="col">Tank sales (L)</th>
                      <th scope="col">Total sales (L)</th>
                      <th scope="col">Expected revenue (KES)</th>
                      <th scope="col">Collections (KES)</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.recentReports.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="ssr__date-cell">
                            <CalendarDays size={14} strokeWidth={2} aria-hidden />
                            {row.reportingDateLabel}
                          </span>
                        </td>
                        <td>{row.meterSales}</td>
                        <td>{row.tankSales}</td>
                        <td>{row.totalSales}</td>
                        <td>{row.expectedRevenue}</td>
                        <td>{row.collections}</td>
                        <td>
                          <span className="ssr__pill ssr__pill--closed">
                            <Check size={12} strokeWidth={2.5} aria-hidden />
                            Closed
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/dealer/stock-reporting/report/${row.id}`}
                            className="ssr__view"
                          >
                            <Eye size={15} strokeWidth={2.25} aria-hidden />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {confirmReset ? (
        <div
          className="ssr__dialog-backdrop"
          role="presentation"
          onClick={() => !pending && setConfirmReset(false)}
        >
          <div
            className="ssr__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ssr-reset-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ssr-reset-title">Start over?</h3>
            <p>
              This clears saved draft progress for today&apos;s report (pump meters, tank dips, wet
              stock, and monetary entries). Closed reports cannot be reset from this screen.
            </p>
            <div className="ssr__dialog-actions">
              <button
                type="button"
                className="ssr__btn ssr__btn--ghost"
                disabled={pending}
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ssr__btn ssr__btn--primary"
                disabled={pending}
                onClick={() => runAction("reset")}
              >
                {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                Reset draft
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
