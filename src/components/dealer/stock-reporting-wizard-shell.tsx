"use client";

import Link from "next/link";
import { Check, Save } from "lucide-react";
import { DealerHeroMedia } from "@/components/dealer/dealer-hero-media";
import { STOCK_REPORT_WIZARD_STAGES, type StockReportStageId } from "@/lib/stock-reporting/constants";
import { isStageCompleted, nextIncompleteStage } from "@/lib/stock-reporting/progress";
import { cn } from "@/lib/utils";
import { DealerHeroActions } from "./dealer-hero-actions";
import "@/app/dealer/dealer-stock-wizard.css";
import "@/app/dealer/dealer-portal-hero.css";

type ProgressFields = {
  status: "DRAFT" | "CLOSED";
  pumpMetersCompletedAt: Date | string | null;
  tankDipsCompletedAt: Date | string | null;
  wetStockCompletedAt: Date | string | null;
  monetaryCompletedAt: Date | string | null;
};

function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

export function StockReportingWizardShell({
  stationName,
  currentStage,
  reportProgress,
  onSaveExit,
  saveExitPending,
  children,
}: {
  stationName: string;
  currentStage: StockReportStageId;
  reportProgress: ProgressFields;
  onSaveExit?: () => void;
  saveExitPending?: boolean;
  children: React.ReactNode;
}) {
  const progress = {
    status: reportProgress.status,
    pumpMetersCompletedAt: toDate(reportProgress.pumpMetersCompletedAt),
    tankDipsCompletedAt: toDate(reportProgress.tankDipsCompletedAt),
    wetStockCompletedAt: toDate(reportProgress.wetStockCompletedAt),
    monetaryCompletedAt: toDate(reportProgress.monetaryCompletedAt),
  };
  const nextOpen = nextIncompleteStage(progress);
  const closed = progress.status === "CLOSED";

  return (
    <div className="ssw">
      <section className="ssw__hero" aria-label="Daily stock report">
        <DealerHeroMedia />
        <div className="ssw__hero-veil" aria-hidden />
        <div className="ssw__hero-inner">
          <div className="ssw__hero-copy">
            <span className="ssw__hero-accent" aria-hidden />
            <div>
              <p className="ssw__hero-kicker">Stock Sale Reporting</p>
              <h1>Daily Report – {stationName} Station</h1>
              <p>
                Record meter readings, tank dips, reconcile stock and monetary sales, and close the
                shift.
              </p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <div className="ssw__body">
        <aside className="ssw__aside" aria-label="Reporting stages">
          <ol className="ssw__steps">
            {STOCK_REPORT_WIZARD_STAGES.map((stage, index) => {
              const done = isStageCompleted(progress, stage.id);
              const active = stage.id === currentStage;
              const reachable =
                closed || done || stage.id === nextOpen || stage.id === currentStage;
              return (
                <li key={stage.id} className="ssw__step">
                  {index < STOCK_REPORT_WIZARD_STAGES.length - 1 ? (
                    <span className="ssw__step-rail" aria-hidden />
                  ) : null}
                  {reachable ? (
                    <Link
                      href={stage.href}
                      className={cn(
                        "ssw__step-link",
                        active && "is-active",
                        done && !active && "is-done"
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      <span className="ssw__step-num" aria-hidden>
                        {done && !active ? <Check size={14} strokeWidth={2.75} /> : stage.step}
                      </span>
                      <span className="ssw__step-label">{stage.label}</span>
                    </Link>
                  ) : (
                    <span className="ssw__step-link is-disabled" aria-disabled="true">
                      <span className="ssw__step-num" aria-hidden>
                        {stage.step}
                      </span>
                      <span className="ssw__step-label">{stage.label}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="ssw__aside-divider" />

          <button
            type="button"
            className="ssw__save-exit"
            onClick={onSaveExit}
            disabled={saveExitPending || closed || !onSaveExit}
          >
            <Save size={15} strokeWidth={2.25} aria-hidden />
            Save &amp; Exit
          </button>

        </aside>

        <div className="ssw__panel">{children}</div>
      </div>
    </div>
  );
}
