"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
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
} from "lucide-react";
import { saveTankDipsAction } from "@/lib/stock-reporting/actions";
import {
  calculateTankDip,
  formatLitresFixed,
  formatLitresWithUnit,
  parseLitresInput,
  sumTankSalesByProduct,
} from "@/lib/stock-reporting/tank-calc";
import type { TankReadingRowDto } from "@/lib/stock-reporting/tanks";
import { cn } from "@/lib/utils";
import { StockReportingWizardShell } from "./stock-reporting-wizard-shell";

type DraftRow = { tankKey: string; closing: string };

function toDraft(rows: TankReadingRowDto[]): DraftRow[] {
  return rows.map((r) => ({
    tankKey: r.tankKey,
    closing: r.closingLitres == null ? "" : formatLitresFixed(r.closingLitres),
  }));
}

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

export function TankDipsForm({
  reportId,
  revision: initialRevision,
  stationName,
  reportingDateLabel,
  pumpsLabel,
  tanksLabel,
  readings: initialReadings,
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
  readings: TankReadingRowDto[];
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
  const [draft, setDraft] = useState(() => toDraft(initialReadings));
  const [howOpen, setHowOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const computed = useMemo(() => {
    return initialReadings.map((row) => {
      const d = draft.find((x) => x.tankKey === row.tankKey);
      const closing = parseLitresInput(d?.closing ?? "");
      const calc =
        closing == null
          ? null
          : calculateTankDip({
              capacity: row.capacityLitres,
              opening: row.openingLitres,
              closing,
            });
      return {
        ...row,
        closing,
        sales: calc?.ok ? calc.sales : null,
        ullage: calc?.ok ? calc.ullage : null,
        provisional: calc?.ok ? calc.provisionalReceipt : false,
        calcError: calc && !calc.ok ? calc.error : null,
      };
    });
  }, [draft, initialReadings]);

  const totals = useMemo(
    () => sumTankSalesByProduct(computed.map((r) => ({ product: r.product, sales: r.sales }))),
    [computed]
  );

  const hasProvisional = computed.some((r) => r.provisional);

  function updateRow(tankKey: string, closing: string) {
    setDirty(true);
    setDraft((prev) => prev.map((r) => (r.tankKey === tankKey ? { ...r, closing } : r)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${tankKey}.closing`];
      return next;
    });
  }

  function payload() {
    return draft.map((d) => ({
      tankKey: d.tankKey,
      closingLitres: parseLitresInput(d.closing),
    }));
  }

  function runSave(mode: "draft" | "complete", exitToDashboard = false) {
    setError(null);
    startTransition(async () => {
      const result = await saveTankDipsAction({
        reportId,
        expectedRevision: revision,
        readings: payload(),
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
      currentStage="TANK_DIPS"
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
            <h2>2. Tank Dip Readings</h2>
            <p>
              Enter the closing stock (dip) for each tank. Tank sales and ullage are calculated
              automatically.
            </p>
          </div>
        </div>
        <button type="button" className="ssw__how" onClick={() => setHowOpen((v) => !v)}>
          <Info size={14} strokeWidth={2.25} aria-hidden />
          How it works
        </button>
      </div>

      {howOpen ? (
        <div className="ssw__how-pop" role="note">
          <strong>Opening stock</strong> carries forward from the previous validated closing.{" "}
          <strong>Closing stock</strong> is today&apos;s dip/volume and cannot exceed capacity.{" "}
          <strong>Tank sales = Opening − Closing</strong> when there are no receipts; if closing
          exceeds opening, the figure is provisional until receipts are matched in Wet Stock
          Reconciliation. <strong>Ullage = Capacity − Closing</strong>.
        </div>
      ) : null}

      {error ? (
        <p className="ssw__error" role="alert">
          {error}
        </p>
      ) : null}

      {hasProvisional ? (
        <p className="ssw__error" role="status" style={{ background: "#fff8e6", color: "#92400e" }}>
          One or more tanks show closing stock above opening — treated as provisional until receipts
          are reconciled in Step 3.
        </p>
      ) : null}

      <div className="ssw__table-wrap">
        <table className="ssw__table">
          <thead>
            <tr>
              <th scope="col">Tank</th>
              <th scope="col">Product</th>
              <th scope="col">Tank Capacity (L)</th>
              <th scope="col">
                <span className="ssw__th-tip">
                  Opening Stock (L)
                  <Info size={12} strokeWidth={2.25} aria-hidden />
                </span>
              </th>
              <th scope="col">
                Closing Stock (L) <span className="ssw__req">*</span>
              </th>
              <th scope="col">
                Tank Sales (L)
                <span className="ssw__th-sub">(Opening − Closing)</span>
              </th>
              <th scope="col">
                Ullage (L)
                <span className="ssw__th-sub">(Capacity − Closing)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => {
              const d = draft.find((x) => x.tankKey === row.tankKey)!;
              const closingErr = fieldErrors[`${row.tankKey}.closing`] || row.calcError;
              return (
                <tr key={row.tankKey}>
                  <td>
                    <span className="ssw__pump-cell">
                      <Layers size={15} strokeWidth={2.25} aria-hidden />
                      {row.label}
                    </span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "ssw__badge",
                        row.product === "PMS" ? "ssw__badge--pms" : "ssw__badge--ago"
                      )}
                    >
                      {row.product}
                    </span>
                  </td>
                  <td>
                    <span className="ssw__ro">{formatLitresFixed(row.capacityLitres)}</span>
                  </td>
                  <td>
                    <span className="ssw__ro">{formatLitresFixed(row.openingLitres)}</span>
                  </td>
                  <td>
                    <input
                      className={cn("ssw__input", closingErr && "is-invalid")}
                      inputMode="decimal"
                      value={d.closing}
                      disabled={readOnly || pending}
                      aria-label={`${row.label} closing stock litres`}
                      aria-invalid={Boolean(closingErr)}
                      onChange={(e) => updateRow(row.tankKey, e.target.value)}
                    />
                    {closingErr ? <span className="ssw__field-error">{closingErr}</span> : null}
                  </td>
                  <td>
                    <span className="ssw__ro">
                      {row.sales == null ? "—" : formatLitresFixed(row.sales)}
                    </span>
                  </td>
                  <td>
                    <span className="ssw__ro">
                      {row.ullage == null ? "—" : formatLitresFixed(row.ullage)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ssw__totals" aria-label="Tank sales totals">
        <article className="ssw__total ssw__total--pms">
          <span className="ssw__total-icon">
            <Fuel size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total PMS Tank Sales</p>
            <p className="ssw__total-value">{formatLitresWithUnit(totals.pms)}</p>
          </div>
        </article>
        <article className="ssw__total ssw__total--ago">
          <span className="ssw__total-icon">
            <Fuel size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total AGO Tank Sales</p>
            <p className="ssw__total-value">{formatLitresWithUnit(totals.ago)}</p>
          </div>
        </article>
        <article className="ssw__total ssw__total--all">
          <span className="ssw__total-icon">
            <Layers size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total Tank Sales</p>
            <p className="ssw__total-value">{formatLitresWithUnit(totals.total)}</p>
          </div>
        </article>
      </div>

      <div className="ssw__footer">
        <div className="ssw__status">
          <span className="ssw__status-ok" aria-hidden>
            <Check size={13} strokeWidth={2.75} />
          </span>
          <span>{dirty ? "Unsaved changes" : formatSavedAt(savedAt)}</span>
          <span className="ssw__draft">{reportProgress.status === "CLOSED" ? "Closed" : "Draft"}</span>
        </div>
        <div className="ssw__footer-actions">
          <Link href="/dealer/stock-reporting/pump-meters" className="ssw__btn ssw__btn--ghost">
            <ArrowLeft size={16} strokeWidth={2.5} aria-hidden />
            Back to Pump Meters
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
            Continue to Wet Stock Reconciliation
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </StockReportingWizardShell>
  );
}
