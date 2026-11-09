"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
import { savePumpMetersAction } from "@/lib/stock-reporting/actions";
import {
  calculatePumpSales,
  commitLitresField,
  formatLitresFixed,
  formatLitresWithUnit,
  parseLitresInput,
  sanitizeNumericLitresDraft,
  sumSalesByProduct,
} from "@/lib/stock-reporting/pump-calc";
import type { PumpReadingRowDto } from "@/lib/stock-reporting/pumps";
import { cn } from "@/lib/utils";
import { StockReportingWizardShell } from "./stock-reporting-wizard-shell";
import "@/app/dealer/dealer-stock-wizard.css";

type DraftRow = {
  pumpKey: string;
  opening: string;
  closing: string;
};

function toDraft(rows: PumpReadingRowDto[]): DraftRow[] {
  return rows.map((r) => ({
    pumpKey: r.pumpKey,
    opening: formatLitresFixed(r.openingLitres),
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

export function PumpMetersForm({
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
  readings: PumpReadingRowDto[];
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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const computed = useMemo(() => {
    return initialReadings.map((row) => {
      const d = draft.find((x) => x.pumpKey === row.pumpKey);
      const opening = row.needsOpeningInit
        ? parseLitresInput(d?.opening ?? "") ?? row.openingLitres
        : row.openingLitres;
      const closing = parseLitresInput(d?.closing ?? "");
      const rtt = row.rttLitres ?? 0;
      const calc =
        closing == null
          ? null
          : calculatePumpSales({ opening, closing, rtt });
      return {
        ...row,
        opening,
        closing,
        rtt,
        sales: calc?.ok ? calc.sales : null,
        calcError: calc && !calc.ok ? calc.error : null,
      };
    });
  }, [draft, initialReadings]);

  const totals = useMemo(
    () =>
      sumSalesByProduct(
        computed.map((r) => ({ product: r.product, sales: r.sales }))
      ),
    [computed]
  );

  const needsOpeningInit = initialReadings.some((r) => r.needsOpeningInit);

  function updateRow(pumpKey: string, patch: Partial<DraftRow>) {
    setDirty(true);
    setDraft((prev) => prev.map((r) => (r.pumpKey === pumpKey ? { ...r, ...patch } : r)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${pumpKey}.closing`];
      delete next[`${pumpKey}.opening`];
      return next;
    });
  }

  function onLitresChange(pumpKey: string, field: "opening" | "closing", raw: string) {
    updateRow(pumpKey, { [field]: sanitizeNumericLitresDraft(raw) });
  }

  function onLitresBlur(pumpKey: string, field: "opening" | "closing", raw: string) {
    const committed = commitLitresField(raw, 4);
    if (committed !== raw) updateRow(pumpKey, { [field]: committed });
  }

  function payload() {
    return draft.map((d) => {
      const meta = initialReadings.find((r) => r.pumpKey === d.pumpKey);
      return {
        pumpKey: d.pumpKey,
        closingLitres: parseLitresInput(d.closing),
        openingLitres: meta?.needsOpeningInit ? parseLitresInput(d.opening) : undefined,
      };
    });
  }

  function runSave(mode: "draft" | "complete", exitToDashboard = false) {
    setError(null);
    startTransition(async () => {
      const result = await savePumpMetersAction({
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
      currentStage="PUMP_METERS"
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
            <Fuel size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <h2>1. Pump Meter Readings</h2>
            <p>
              Enter closing meter readings for each pump. RTT is applied automatically from the RTT
              module. Net sales = Closing − Opening − RTT.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="ssw__error" role="alert">
          {error}
        </p>
      ) : null}

      {needsOpeningInit && !readOnly ? (
        <aside
          className="ssw__init-note"
          role="note"
          aria-label="First-Time Meter Setup"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            boxSizing: "border-box",
            width: "100%",
            margin: "0 0 14px",
            padding: "12px 20px",
            minHeight: "70px",
            borderRadius: "12px",
            border: "1px solid #C5D6FF",
            background: "#EEF4FF",
          }}
        >
          <span
            className="ssw__init-note-icon"
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 24,
              height: 24,
              color: "#3551A5",
            }}
          >
            <Info size={20} strokeWidth={2.35} />
          </span>
          <span
            className="ssw__init-note-divider"
            aria-hidden
            style={{
              flexShrink: 0,
              alignSelf: "stretch",
              width: 1,
              minHeight: 38,
              background: "#C5D6FF",
            }}
          />
          <div
            className="ssw__init-note-copy"
            style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}
          >
            <p
              className="ssw__init-note-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                lineHeight: 1.25,
                color: "#3551A5",
              }}
            >
              First-Time Meter Setup
            </p>
            <p
              className="ssw__init-note-text"
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 450,
                lineHeight: 1.4,
                color: "#5B6F8F",
              }}
            >
              Enter each pump&apos;s opening reading once. Future reports will automatically use the
              previous closing reading.
            </p>
          </div>
        </aside>
      ) : null}

      <div className="ssw__table-wrap">
        <table className="ssw__table">
          <thead>
            <tr>
              <th scope="col">Pump / Dispenser</th>
              <th scope="col">Product</th>
              <th scope="col">Opening Meter (L)</th>
              <th scope="col">
                Closing Meter (L) <span className="ssw__req">*</span>
              </th>
              <th scope="col">
                <span className="ssw__th-tip" title="RTT is automatically calculated from test-return entries recorded in the RTT & Truck Calibration module.">
                  RTT Applied (L)
                  <Info size={12} strokeWidth={2.25} aria-hidden />
                </span>
              </th>
              <th scope="col">
                Net Sales (L)
                <span className="ssw__th-sub">(Closing − Opening − RTT)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {computed.map((row) => {
              const d = draft.find((x) => x.pumpKey === row.pumpKey)!;
              const closingErr = fieldErrors[`${row.pumpKey}.closing`] || row.calcError;
              const openingErr = fieldErrors[`${row.pumpKey}.opening`];
              return (
                <tr key={row.pumpKey}>
                  <td>
                    <span className="ssw__pump-cell">
                      <Fuel size={15} strokeWidth={2.25} aria-hidden />
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
                    {row.needsOpeningInit && !readOnly ? (
                      <>
                        <input
                          className={cn("ssw__input", openingErr && "is-invalid")}
                          inputMode="decimal"
                          pattern="[0-9]*[.]?[0-9]*"
                          value={d.opening}
                          disabled={pending}
                          aria-label={`${row.label} initial opening meter litres`}
                          aria-invalid={Boolean(openingErr)}
                          onChange={(e) => onLitresChange(row.pumpKey, "opening", e.target.value)}
                          onBlur={(e) => onLitresBlur(row.pumpKey, "opening", e.target.value)}
                        />
                        {openingErr ? <span className="ssw__field-error">{openingErr}</span> : null}
                      </>
                    ) : (
                      <span className="ssw__ro">{formatLitresFixed(row.openingLitres)}</span>
                    )}
                  </td>
                  <td>
                    <input
                      className={cn("ssw__input", closingErr && "is-invalid")}
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      value={d.closing}
                      disabled={readOnly || pending}
                      aria-label={`${row.label} closing meter litres`}
                      aria-invalid={Boolean(closingErr)}
                      onChange={(e) => onLitresChange(row.pumpKey, "closing", e.target.value)}
                      onBlur={(e) => onLitresBlur(row.pumpKey, "closing", e.target.value)}
                    />
                    {closingErr ? <span className="ssw__field-error">{closingErr}</span> : null}
                  </td>
                  <td>
                    <span className="ssw__ro" title="From RTT & Truck Calibration module">
                      {formatLitresFixed(row.rtt)}
                    </span>
                  </td>
                  <td>
                    <span className="ssw__ro">
                      {row.sales == null ? "—" : formatLitresFixed(row.sales)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ssw__totals" aria-label="Fuel sales totals">
        <article className="ssw__total ssw__total--pms">
          <span className="ssw__total-icon">
            <Fuel size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total PMS Sales</p>
            <p className="ssw__total-value">{formatLitresWithUnit(totals.pms)}</p>
          </div>
        </article>
        <article className="ssw__total ssw__total--ago">
          <span className="ssw__total-icon">
            <Fuel size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total AGO Sales</p>
            <p className="ssw__total-value">{formatLitresWithUnit(totals.ago)}</p>
          </div>
        </article>
        <article className="ssw__total ssw__total--all">
          <span className="ssw__total-icon">
            <Layers size={18} strokeWidth={2.25} aria-hidden />
          </span>
          <div>
            <p className="ssw__total-label">Total Fuel Sales</p>
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
            Continue to Tank Dip Readings
            <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </StockReportingWizardShell>
  );
}
