"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  Crosshair,
  Fuel,
  Info,
  Layers,
  Loader2,
  Pencil,
  Send,
  Smartphone,
  Wallet,
} from "lucide-react";
import { saveMonetaryAction } from "@/lib/stock-reporting/actions";
import { formatLitresWithUnit } from "@/lib/stock-reporting/pump-calc";
import {
  computeMonetarySummary,
  formatKesFixed,
  formatKesSigned,
  formatKesWithCurrency,
  parseKesInput,
} from "@/lib/stock-reporting/monetary-calc";
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

function toInputDisplay(value: number | null): string {
  return value == null ? "" : formatKesFixed(value);
}

export function MonetaryForm({
  reportId,
  revision: initialRevision,
  stationName,
  reportingDateLabel,
  pumpsLabel,
  tanksLabel,
  meterPms,
  meterAgo,
  totalSalesLitres,
  pricePms,
  priceAgo,
  priceNote,
  pricesMissing,
  initialCash,
  initialMpesa,
  initialCard,
  initialDiscrepancyReason,
  wetState,
  wetResolution,
  updatedAt,
  reportProgress,
  readOnly,
}: {
  reportId: string;
  revision: number;
  stationName: string;
  reportingDateLabel: string;
  pumpsLabel: string;
  tanksLabel: string;
  meterPms: number;
  meterAgo: number;
  totalSalesLitres: number;
  pricePms: number | null;
  priceAgo: number | null;
  priceNote: string;
  pricesMissing: boolean;
  initialCash: number | null;
  initialMpesa: number | null;
  initialCard: number | null;
  initialDiscrepancyReason: string | null;
  wetState: string;
  wetResolution: string;
  updatedAt: string;
  reportProgress: {
    status: "DRAFT" | "CLOSED";
    pumpMetersCompletedAt: string | null;
    tankDipsCompletedAt: string | null;
    wetStockCompletedAt: string | null;
    monetaryCompletedAt: string | null;
  };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [cash, setCash] = useState(toInputDisplay(initialCash));
  const [mpesa, setMpesa] = useState(toInputDisplay(initialMpesa));
  const [card, setCard] = useState(toInputDisplay(initialCard));
  const [discrepancyReason, setDiscrepancyReason] = useState(initialDiscrepancyReason ?? "");
  const [howOpen, setHowOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(
    () =>
      computeMonetarySummary({
        meterPms,
        meterAgo,
        pricePms,
        priceAgo,
        cashKes: parseKesInput(cash),
        mpesaKes: parseKesInput(mpesa),
        cardKes: parseKesInput(card),
      }),
    [meterPms, meterAgo, pricePms, priceAgo, cash, mpesa, card]
  );

  function markDirty() {
    setDirty(true);
    setError(null);
  }

  function runSave(mode: "draft" | "close", opts?: { exitToDashboard?: boolean; confirmClose?: boolean }) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveMonetaryAction({
        reportId,
        expectedRevision: revision,
        cashRaw: cash,
        mpesaRaw: mpesa,
        cardRaw: card,
        discrepancyReason: discrepancyReason || null,
        mode,
        confirmClose: opts?.confirmClose,
        exitToDashboard: opts?.exitToDashboard,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        setConfirmOpen(false);
        return;
      }
      setDirty(false);
      setSavedAt(new Date().toISOString());
      if (result.revision != null) setRevision(result.revision);
      setConfirmOpen(false);
      router.push(result.redirectTo);
      router.refresh();
    });
  }

  const diffClass =
    summary.state === "BALANCED"
      ? "is-balanced"
      : summary.state === "SHORTAGE"
        ? "is-shortage"
        : summary.state === "OVERAGE"
          ? "is-overage"
          : "";

  return (
    <StockReportingWizardShell
      stationName={stationName}
      currentStage="MONETARY"
      reportProgress={reportProgress}
      saveExitPending={pending}
      onSaveExit={readOnly ? undefined : () => runSave("draft", { exitToDashboard: true })}
    >
      <div className="ssw__meta" aria-label="Report summary">
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <CalendarDays size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Reporting Date</p>
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
            <Layers size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <h2>4. Monetary Reconciliation</h2>
            <p>
              Reconcile expected sales (from meter readings) with actual collections (Cash, M-Pesa and
              Visa).
            </p>
          </div>
        </div>
        <button type="button" className="ssw__how" onClick={() => setHowOpen((v) => !v)}>
          <Info size={14} strokeWidth={2.25} aria-hidden />
          How monetary reconciliation works
        </button>
      </div>

      {howOpen ? (
        <div className="ssw__how-pop" role="note">
          <strong>Expected sales</strong> = meter volume × snapshotted pump selling price per litre.{" "}
          <strong>Collections</strong> are manual Cash, M-Pesa, and Visa/Card totals for the day
          (not verified payment imports). <strong>Difference</strong> = Total Collections − Expected
          Sales (signed). Exact balance is required to close the shift; shortage/overage approval
          policy is not yet configured. Closing freezes the report as submitted.
        </div>
      ) : null}

      {pricesMissing ? (
        <p className="ssw__error" role="alert">
          {priceNote}
        </p>
      ) : (
        <p className="ssw__price-note">{priceNote}</p>
      )}

      {error ? (
        <p className="ssw__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ssw__money-top" aria-label="Expected sales comparison">
        <article className="ssw__money-card ssw__money-card--expected">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Fuel size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>Expected Sales (from Meter Readings)</h3>
              <p>Sales volume multiplied by the selling price per litre.</p>
            </div>
          </div>
          <div className="ssw__money-table-wrap">
            <table className="ssw__money-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Volume Sold (L)</th>
                  <th scope="col">Selling Price (KES/L)</th>
                  <th scope="col">Expected Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line) => (
                  <tr key={line.product}>
                    <td>
                      <span
                        className={cn(
                          "ssw__badge",
                          line.product === "PMS" ? "ssw__badge--pms" : "ssw__badge--ago"
                        )}
                      >
                        {line.product}
                      </span>
                    </td>
                    <td>{formatLitresWithUnit(line.volumeLitres)}</td>
                    <td>
                      {line.priceKesPerLitre == null
                        ? "—"
                        : formatKesFixed(line.priceKesPerLitre)}
                    </td>
                    <td>
                      {line.expectedKes == null ? "—" : formatKesFixed(line.expectedKes)}
                    </td>
                  </tr>
                ))}
                <tr className="ssw__mini-total">
                  <td colSpan={3}>Total Expected Sales</td>
                  <td>{formatKesWithCurrency(summary.expectedTotalKes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="ssw__money-card ssw__money-card--vs">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Crosshair size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h3>Expected vs. Collections</h3>
              <p>Compare expected meter sales with recorded collections.</p>
            </div>
          </div>
          <ul className="ssw__vs-list">
            <li>
              <span className="ssw__vs-ico ssw__vs-ico--wallet">
                <Wallet size={16} strokeWidth={2.25} aria-hidden />
              </span>
              <div>
                <p className="ssw__vs-label">Expected Sales (Meter)</p>
                <p className="ssw__vs-value">{formatKesWithCurrency(summary.expectedTotalKes)}</p>
              </div>
            </li>
            <li>
              <span className="ssw__vs-ico">
                <Layers size={16} strokeWidth={2.25} aria-hidden />
              </span>
              <div>
                <p className="ssw__vs-label">Total Collections (Cash + M-Pesa + Visa)</p>
                <p className="ssw__vs-value">
                  {formatKesWithCurrency(summary.collectionsTotalKes)}
                </p>
              </div>
            </li>
            <li className={cn("ssw__vs-diff", diffClass)}>
              <span className="ssw__vs-ico ssw__vs-ico--diff">
                <Check size={16} strokeWidth={2.75} aria-hidden />
              </span>
              <div>
                <p className="ssw__vs-label">Difference</p>
                <p className="ssw__vs-value">
                  {summary.differenceKes == null
                    ? "—"
                    : formatKesSigned(summary.differenceKes)}
                </p>
              </div>
            </li>
          </ul>
        </article>
      </div>

      <section className="ssw__collections" aria-label="Actual collections">
        <div className="ssw__collections-head">
          <span className="ssw__section-icon">
            <Wallet size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <h3>
            Actual Collections
            <span>Enter total amount received for the day.</span>
          </h3>
        </div>

        <div className="ssw__collection-grid">
          <label className="ssw__collect-card ssw__collect-card--cash">
            <span className="ssw__collect-icon">
              <Banknote size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="ssw__collect-label">Cash</span>
            <span className="ssw__collect-input">
              <span className="ssw__collect-prefix">KES</span>
              <input
                inputMode="decimal"
                value={cash}
                disabled={readOnly || pending}
                aria-invalid={Boolean(fieldErrors.cash)}
                onChange={(e) => {
                  markDirty();
                  setCash(e.target.value);
                }}
                placeholder="0.00"
              />
            </span>
            {fieldErrors.cash ? <span className="ssw__field-error">{fieldErrors.cash}</span> : null}
          </label>

          <label className="ssw__collect-card ssw__collect-card--mpesa">
            <span className="ssw__collect-icon ssw__collect-icon--mpesa">
              <Smartphone size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="ssw__collect-label">M-Pesa</span>
            <span className="ssw__collect-input">
              <span className="ssw__collect-prefix">KES</span>
              <input
                inputMode="decimal"
                value={mpesa}
                disabled={readOnly || pending}
                aria-invalid={Boolean(fieldErrors.mpesa)}
                onChange={(e) => {
                  markDirty();
                  setMpesa(e.target.value);
                }}
                placeholder="0.00"
              />
            </span>
            {fieldErrors.mpesa ? <span className="ssw__field-error">{fieldErrors.mpesa}</span> : null}
          </label>

          <label className="ssw__collect-card ssw__collect-card--card">
            <span className="ssw__collect-icon">
              <CreditCard size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="ssw__collect-label">Visa / Card</span>
            <span className="ssw__collect-input">
              <span className="ssw__collect-prefix">KES</span>
              <input
                inputMode="decimal"
                value={card}
                disabled={readOnly || pending}
                aria-invalid={Boolean(fieldErrors.card)}
                onChange={(e) => {
                  markDirty();
                  setCard(e.target.value);
                }}
                placeholder="0.00"
              />
            </span>
            {fieldErrors.card ? <span className="ssw__field-error">{fieldErrors.card}</span> : null}
          </label>

          <div className="ssw__collect-card ssw__collect-card--total" aria-live="polite">
            <span className="ssw__collect-icon ssw__collect-icon--total">
              <Layers size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="ssw__collect-label">Total Collections</span>
            <strong className="ssw__collect-total">
              {formatKesWithCurrency(summary.collectionsTotalKes)}
            </strong>
          </div>
        </div>
      </section>

      {summary.state === "BALANCED" ? (
        <div className="ssw__money-banner ssw__money-banner--ok" role="status">
          <span className="ssw__money-banner-ico" aria-hidden>
            <Check size={18} strokeWidth={2.75} />
          </span>
          <div>
            <strong>Monetary Reconciliation Balanced</strong>
            <p>
              Total collections match the expected sales. You can now close and submit the daily
              report.
            </p>
          </div>
        </div>
      ) : null}

      {summary.state === "SHORTAGE" ? (
        <div className="ssw__money-banner ssw__money-banner--warn" role="status">
          <span className="ssw__money-banner-ico" aria-hidden>
            <Info size={18} strokeWidth={2.5} />
          </span>
          <div>
            <strong>Collection Shortage Detected</strong>
            <p>
              Recorded collections are {formatKesWithCurrency(Math.abs(summary.differenceKes ?? 0))}{" "}
              below expected sales. Review the amounts before submitting. Exact balance is required
              for normal closure.
            </p>
          </div>
        </div>
      ) : null}

      {summary.state === "OVERAGE" ? (
        <div className="ssw__money-banner ssw__money-banner--warn" role="status">
          <span className="ssw__money-banner-ico" aria-hidden>
            <Info size={18} strokeWidth={2.5} />
          </span>
          <div>
            <strong>Collection Overage Detected</strong>
            <p>
              Recorded collections exceed expected sales by{" "}
              {formatKesWithCurrency(summary.differenceKes)}. Review the amounts before submitting.
              Exact balance is required for normal closure.
            </p>
          </div>
        </div>
      ) : null}

      {summary.state === "INCOMPLETE" ? (
        <div className="ssw__money-banner ssw__money-banner--info" role="status">
          <span className="ssw__money-banner-ico" aria-hidden>
            <Info size={18} strokeWidth={2.5} />
          </span>
          <div>
            <strong>Monetary Reconciliation Incomplete</strong>
            <p>
              {pricesMissing
                ? "Selling prices are missing, so expected sales cannot be finalized."
                : "Enter Cash, M-Pesa, and Visa/Card amounts to calculate the difference. Blank fields are not treated as zero."}
            </p>
          </div>
        </div>
      ) : null}

      {summary.state === "SHORTAGE" || summary.state === "OVERAGE" ? (
        <div className="ssw__opt-panel" style={{ marginBottom: "1rem" }}>
          <h4>Discrepancy note (optional)</h4>
          <p>
            You may record an explanation while correcting collections. Closing with a shortage or
            overage is blocked until an approved tolerance/approval policy is configured.
          </p>
          <textarea
            value={discrepancyReason}
            disabled={readOnly || pending}
            aria-invalid={Boolean(fieldErrors.discrepancyReason)}
            onChange={(e) => {
              markDirty();
              setDiscrepancyReason(e.target.value);
            }}
            placeholder="Describe why collections differ from expected sales…"
          />
          {fieldErrors.discrepancyReason ? (
            <span className="ssw__field-error">{fieldErrors.discrepancyReason}</span>
          ) : null}
        </div>
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
          <Link href="/dealer/stock-reporting/wet-stock" className="ssw__btn ssw__btn--ghost">
            <ArrowLeft size={16} strokeWidth={2.5} aria-hidden />
            Back to Wet Stock Reconciliation
          </Link>
          <button
            type="button"
            className="ssw__btn ssw__btn--ghost"
            disabled={pending || readOnly}
            onClick={() => runSave("draft")}
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            Save as Draft
          </button>
          <button
            type="button"
            className="ssw__btn ssw__btn--primary"
            disabled={pending || readOnly}
            onClick={() => setConfirmOpen(true)}
          >
            Close Shift &amp; Submit Report
            <Send size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="ssw__modal-backdrop" role="presentation">
          <div
            className="ssw__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-shift-title"
          >
            <h3 id="close-shift-title">Close and Submit Daily Report?</h3>
            <dl className="ssw__modal-summary">
              <div>
                <dt>Station</dt>
                <dd>{stationName}</dd>
              </div>
              <div>
                <dt>Reporting date</dt>
                <dd>{reportingDateLabel}</dd>
              </div>
              <div>
                <dt>Total fuel sold</dt>
                <dd>{formatLitresWithUnit(totalSalesLitres)}</dd>
              </div>
              <div>
                <dt>Expected sales</dt>
                <dd>{formatKesWithCurrency(summary.expectedTotalKes)}</dd>
              </div>
              <div>
                <dt>Total collections</dt>
                <dd>{formatKesWithCurrency(summary.collectionsTotalKes)}</dd>
              </div>
              <div>
                <dt>Monetary difference</dt>
                <dd>
                  {summary.differenceKes == null
                    ? "—"
                    : formatKesSigned(summary.differenceKes)}
                </dd>
              </div>
              <div>
                <dt>Wet stock</dt>
                <dd>
                  {wetResolution} · {wetState}
                </dd>
              </div>
            </dl>
            <div className="ssw__modal-actions">
              <button
                type="button"
                className="ssw__btn ssw__btn--ghost"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ssw__btn ssw__btn--primary"
                disabled={pending}
                onClick={() => runSave("close", { confirmClose: true })}
              >
                {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                Confirm &amp; Close Shift
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StockReportingWizardShell>
  );
}
