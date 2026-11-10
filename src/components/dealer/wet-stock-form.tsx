"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Fuel,
  Info,
  Layers,
  Loader2,
  Pencil,
  Scale,
  Truck,
} from "lucide-react";
import { saveWetStockAction } from "@/lib/stock-reporting/actions";
import { formatLitresWithUnit } from "@/lib/stock-reporting/pump-calc";
import {
  computeWetVariances,
  formatVarianceLitres,
} from "@/lib/stock-reporting/wet-calc";
import type { WetResolutionChoice } from "@/lib/stock-reporting/wet";
import { cn } from "@/lib/utils";
import { StockReportingWizardShell } from "./stock-reporting-wizard-shell";

function formatSavedAt(iso: string | null) {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay) return `Last saved: Today, ${time}`;
  return `Last saved: ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${time}`;
}

type ResolutionUi = WetResolutionChoice | "NONE";

export function WetStockForm({
  reportId,
  revision: initialRevision,
  stationName,
  reportingDateLabel,
  pumpsLabel,
  tanksLabel,
  meterPms,
  meterAgo,
  tankPms,
  tankAgo,
  initialResolution,
  initialLossReason,
  updatedAt,
  reportProgress,
  readOnly,
  eligibleDeliveryCount,
}: {
  reportId: string;
  revision: number;
  stationName: string;
  reportingDateLabel: string;
  pumpsLabel: string;
  tanksLabel: string;
  meterPms: number;
  meterAgo: number;
  tankPms: number;
  tankAgo: number;
  initialResolution: ResolutionUi;
  initialLossReason: string | null;
  updatedAt: string;
  reportProgress: {
    status: "DRAFT" | "CLOSED";
    pumpMetersCompletedAt: string | null;
    tankDipsCompletedAt: string | null;
    wetStockCompletedAt: string | null;
    monetaryCompletedAt: string | null;
  };
  readOnly: boolean;
  eligibleDeliveryCount: number;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [resolution, setResolution] = useState<ResolutionUi>(
    initialResolution === "BALANCED" ? "NONE" : initialResolution
  );
  const [lossReason, setLossReason] = useState(initialLossReason ?? "");
  const [howOpen, setHowOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(
    () =>
      computeWetVariances({
        meterPms,
        meterAgo,
        tankPms,
        tankAgo,
      }),
    [meterPms, meterAgo, tankPms, tankAgo]
  );

  function pick(next: ResolutionUi) {
    if (readOnly) return;
    setDirty(true);
    setResolution(next);
    setError(null);
  }

  function runSave(mode: "draft" | "complete", exitToDashboard = false) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveWetStockAction({
        reportId,
        expectedRevision: revision,
        resolution: summary.balanced ? "BALANCED" : resolution,
        lossReason: resolution === "RECORD_LOSS" ? lossReason : null,
        mode,
        exitToDashboard,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setDirty(false);
      setSavedAt(new Date().toISOString());
      if (result.revision != null) setRevision(result.revision);
      router.push(result.redirectTo);
      router.refresh();
    });
  }

  return (
    <StockReportingWizardShell
      stationName={stationName}
      currentStage="WET_STOCK"
      reportProgress={reportProgress}
      saveExitPending={pending}
      onSaveExit={readOnly ? undefined : () => runSave("draft", true)}
    >
      <div className="ssw__meta" aria-label="Report summary">
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <CalendarDays size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Reporting date</p>
            <p className="ssw__meta-value">{reportingDateLabel}</p>
          </div>
          <button
            type="button"
            className="ssw__meta-edit"
            title="Reporting date follows the Nairobi business day for this draft"
            aria-label="Reporting date information"
            onClick={() =>
              setError(
                "The reporting date follows today’s Nairobi business day. Changing it requires an authorized correction process."
              )
            }
          >
            <Pencil size={14} strokeWidth={2.25} aria-hidden />
          </button>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Building2 size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Station</p>
            <p className="ssw__meta-value">{stationName}</p>
          </div>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Fuel size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Pumps</p>
            <p className="ssw__meta-value">{pumpsLabel}</p>
          </div>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Layers size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Tanks</p>
            <p className="ssw__meta-value">{tanksLabel}</p>
          </div>
        </article>
      </div>

      <div className="ssw__section-head">
        <div className="ssw__section-title">
          <span className="ssw__section-icon">
            <Scale size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <h2>3. Wet Stock Reconciliation</h2>
            <p>Compare sales from meter readings and tank dips, and reconcile any variance.</p>
          </div>
        </div>
        <button type="button" className="ssw__how" onClick={() => setHowOpen((v) => !v)}>
          <Info size={14} strokeWidth={2.25} aria-hidden />
          How reconciliation works
        </button>
      </div>

      {howOpen ? (
        <div className="ssw__how-pop" role="note">
          <strong>Meter sales</strong> come from Step 1. <strong>Tank stock sales</strong> come from
          Step 2 (Opening − Closing, adjusted for verified receipts when available).{" "}
          <strong>Variance = meter − tank</strong> per product (signed). Match a delivery only when a
          verified receipt exists; otherwise correct readings or acknowledge a variance for review.
          Acknowledging does not automatically post an inventory write-off.
        </div>
      ) : null}

      {error ? (
        <p className="ssw__error" role="alert">
          {error}
        </p>
      ) : null}

      {summary.balanced ? (
        <p className="ssw__balanced" role="status">
          Meter and tank figures are balanced (no actionable variance). You can continue to Monetary
          Reconciliation.
        </p>
      ) : null}

      <div className="ssw__compare" aria-label="Wet stock comparison">
        <article className="ssw__compare-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Fuel size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>Meter sales (from pump readings)</h3>
              <p>Total stock sold based on dispenser meter readings.</p>
            </div>
          </div>
          <table className="ssw__mini">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Sales (L)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PMS</td>
                <td>{formatVarianceLitres(summary.meterPms)}</td>
              </tr>
              <tr>
                <td>AGO</td>
                <td>{formatVarianceLitres(summary.meterAgo)}</td>
              </tr>
              <tr className="ssw__mini-total">
                <td>Total meter sales</td>
                <td>{formatLitresWithUnit(summary.meterTotal)}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="ssw__compare-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Layers size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>Tank stock sales (from dip readings)</h3>
              <p>Total stock movement based on physical tank readings.</p>
            </div>
          </div>
          <table className="ssw__mini">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Tank sales (L)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PMS</td>
                <td>{formatVarianceLitres(summary.tankPms)}</td>
              </tr>
              <tr>
                <td>AGO</td>
                <td>{formatVarianceLitres(summary.tankAgo)}</td>
              </tr>
              <tr className="ssw__mini-total">
                <td>Total tank sales</td>
                <td>{formatLitresWithUnit(summary.tankTotal)}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="ssw__compare-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon ssw__compare-icon--var">
              <Activity size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>Variance</h3>
              <p>Difference between meter and tank sales.</p>
            </div>
          </div>
          <table className="ssw__mini">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Variance (L)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PMS</td>
                <td>{formatVarianceLitres(summary.variancePms)}</td>
              </tr>
              <tr>
                <td>AGO</td>
                <td>{formatVarianceLitres(summary.varianceAgo)}</td>
              </tr>
              <tr className="ssw__mini-total ssw__mini-total--var">
                <td>Total variance</td>
                <td>{formatLitresWithUnit(Math.abs(summary.varianceTotal))}</td>
              </tr>
            </tbody>
          </table>
          {!summary.balanced && summary.absoluteVariance !== Math.abs(summary.varianceTotal) ? (
            <p style={{ margin: "0.55rem 0 0", fontSize: "0.74rem", color: "#64748b" }}>
              Absolute product variance: {formatLitresWithUnit(summary.absoluteVariance)} (net{" "}
              {formatVarianceLitres(summary.varianceTotal)} L)
            </p>
          ) : null}
        </article>
      </div>

      {!summary.balanced ? (
        <section className="ssw__resolve" aria-label="Variance resolution">
          <div className="ssw__resolve-head">
            <span className="ssw__section-icon">
              <Scale size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>
                How would you like to reconcile the variance of{" "}
                {formatVarianceLitres(Math.abs(summary.varianceTotal))} L?
              </h3>
              <p>Select the most applicable option to proceed.</p>
            </div>
          </div>

          <div className="ssw__resolve-options" role="radiogroup" aria-label="Resolution method">
            <button
              type="button"
              className={cn("ssw__opt", resolution === "MATCH_DELIVERY" && "is-selected")}
              aria-checked={resolution === "MATCH_DELIVERY"}
              role="radio"
              disabled={readOnly || pending}
              onClick={() => pick("MATCH_DELIVERY")}
            >
              <div className="ssw__opt-top">
                <span className="ssw__opt-icon">
                  <Truck size={18} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="ssw__radio" aria-hidden>
                  {resolution === "MATCH_DELIVERY" ? <span className="ssw__radio-dot" /> : null}
                </span>
              </div>
              <strong>Match a stock delivery</strong>
              <span>Reconcile using a confirmed delivery received today.</span>
            </button>

            <button
              type="button"
              className={cn("ssw__opt", resolution === "REVIEW_READINGS" && "is-selected")}
              aria-checked={resolution === "REVIEW_READINGS"}
              role="radio"
              disabled={readOnly || pending}
              onClick={() => pick("REVIEW_READINGS")}
            >
              <div className="ssw__opt-top">
                <span className="ssw__opt-icon">
                  <Pencil size={18} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="ssw__radio" aria-hidden>
                  {resolution === "REVIEW_READINGS" ? <span className="ssw__radio-dot" /> : null}
                </span>
              </div>
              <strong>Review &amp; correct readings</strong>
              <span>Go back to adjust pump meters or tank dip readings.</span>
            </button>

            <button
              type="button"
              className={cn("ssw__opt", resolution === "RECORD_LOSS" && "is-selected")}
              aria-checked={resolution === "RECORD_LOSS"}
              role="radio"
              disabled={readOnly || pending}
              onClick={() => pick("RECORD_LOSS")}
            >
              <div className="ssw__opt-top">
                <span className="ssw__opt-icon">
                  <Layers size={18} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="ssw__radio" aria-hidden>
                  {resolution === "RECORD_LOSS" ? <span className="ssw__radio-dot" /> : null}
                </span>
              </div>
              <strong>Record as Loss</strong>
              <span>
                Acknowledge the {formatVarianceLitres(Math.abs(summary.varianceTotal))} L variance
                as a stock loss and proceed.
              </span>
            </button>
          </div>

          {resolution === "MATCH_DELIVERY" ? (
            <div className="ssw__opt-panel">
              <h4>Stock deliveries</h4>
              {eligibleDeliveryCount === 0 ? (
                <p>
                  No eligible stock deliveries were found for this reporting period. Choose another
                  option or correct readings. Deliveries are never invented.
                </p>
              ) : (
                <p>{eligibleDeliveryCount} eligible delivery record(s) available to match.</p>
              )}
            </div>
          ) : null}

          {resolution === "REVIEW_READINGS" ? (
            <div className="ssw__opt-panel">
              <h4>Review source readings</h4>
              <p>
                Corrections in Steps 1–2 recalculate this reconciliation and clear a stale loss
                acknowledgment if the figures change.
              </p>
              <div className="ssw__opt-actions">
                <Link href="/dealer/stock-reporting/pump-meters" className="ssw__btn ssw__btn--ghost">
                  Review pump meter readings
                </Link>
                <Link href="/dealer/stock-reporting/tank-dips" className="ssw__btn ssw__btn--ghost">
                  Review tank dip readings
                </Link>
              </div>
            </div>
          ) : null}

          {resolution === "RECORD_LOSS" ? (
            <div className="ssw__opt-panel">
              <h4>Acknowledge variance for review</h4>
              <p>
                Product variances — PMS: {formatVarianceLitres(summary.variancePms)} L · AGO:{" "}
                {formatVarianceLitres(summary.varianceAgo)} L. This records a pending review; it does
                not automatically post an inventory write-off.
              </p>
              <label className="ssw__meta-label" htmlFor="wet-loss-reason">
                Explanation
              </label>
              <textarea
                id="wet-loss-reason"
                value={lossReason}
                disabled={readOnly || pending}
                aria-invalid={Boolean(fieldErrors.lossReason)}
                onChange={(e) => {
                  setDirty(true);
                  setLossReason(e.target.value);
                }}
                placeholder="Describe the operational reason for acknowledging this variance…"
              />
              {fieldErrors.lossReason ? (
                <span className="ssw__field-error">{fieldErrors.lossReason}</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="ssw__footer">
        <div className="ssw__status">
          <span className="ssw__status-ok" aria-hidden>
            <Check size={13} strokeWidth={2.75} />
          </span>
          <span>{dirty ? "Unsaved changes" : formatSavedAt(savedAt)}</span>
          <span className="ssw__draft">{reportProgress.status === "CLOSED" ? "Closed" : "Draft"}</span>
        </div>
        <div className="ssw__footer-actions">
          <Link href="/dealer/stock-reporting/tank-dips" className="ssw__btn ssw__btn--ghost">
            <ArrowLeft size={16} strokeWidth={2.5} aria-hidden />
            Back to tank dip readings
          </Link>
          <button
            type="button"
            className="ssw__btn ssw__btn--ghost"
            disabled={pending || readOnly}
            onClick={() => runSave("draft", false)}
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            Save as Draft
          </button>
          <button
            type="button"
            className="ssw__btn ssw__btn--primary"
            disabled={pending || readOnly}
            onClick={() => runSave("complete", false)}
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            Continue to Monetary Reconciliation
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </StockReportingWizardShell>
  );
}
