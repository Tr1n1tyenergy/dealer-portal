"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Beaker,
  ClipboardList,
  Coins,
  Download,
  Eye,
  FileText,
  Fuel,
  Info,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import {
  correctRttEventAction,
  createRttEventAction,
} from "@/lib/stock-reporting/actions";
import {
  formatLitresFixed,
  formatLitresWithUnit,
} from "@/lib/stock-reporting/pump-calc";
import {
  RTT_JOB_CARD_MAX_BYTES,
  RTT_REASON_MAX_CHARS,
} from "@/lib/stock-reporting/rtt-constants";
import type {
  RttEventDto,
  RttPumpOption,
  RttPumpSummary,
} from "@/lib/stock-reporting/rtt";
import { cn } from "@/lib/utils";
import { StockReportingModuleShell } from "./stock-reporting-module-shell";

function newSubmissionKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rtt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatEventDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Nairobi",
  });
}

function shortName(name: string | null) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]![0]}.`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tankShortLabel(label: string | null) {
  if (!label) return "—";
  return label
    .replace(/^PMS\s+Tank\s+/i, "PMS T")
    .replace(/^AGO\s+Tank\s+/i, "AGO T");
}

export function RttCalibrationPage({
  stationId,
  stationName,
  reportingDateLabel,
  reportingDateIso,
  pumps,
  summaries,
  events,
  totals,
}: {
  stationId: string;
  stationName: string;
  reportingDateLabel: string;
  reportingDateIso: string;
  pumps: RttPumpOption[];
  summaries: RttPumpSummary[];
  events: RttEventDto[];
  totals: { eventCount: number; totalPms: number; totalAgo: number; total: number };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"rtt" | "truck">("rtt");
  const [pumpId, setPumpId] = useState("");
  const [volume, setVolume] = useState("");
  const [reason, setReason] = useState("");
  const [jobCard, setJobCard] = useState<File | null>(null);
  const [jobCardError, setJobCardError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submissionKey, setSubmissionKey] = useState(newSubmissionKey);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pumpFilter, setPumpFilter] = useState("ALL");
  const [viewEvent, setViewEvent] = useState<RttEventDto | null>(null);
  const [editEvent, setEditEvent] = useState<RttEventDto | null>(null);
  const [editVolume, setEditVolume] = useState("");
  const [editReason, setEditReason] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedPump = pumps.find((p) => p.id === pumpId) ?? null;

  const productTankLabel = useMemo(() => {
    if (!selectedPump) return { product: "—", tank: "—" };
    return {
      product: selectedPump.product,
      tank: tankShortLabel(selectedPump.linkedTankLabel),
    };
  }, [selectedPump]);

  function clearForm() {
    setPumpId("");
    setVolume("");
    setReason("");
    setJobCard(null);
    setJobCardError(null);
    setFieldErrors({});
    setSubmissionKey(newSubmissionKey());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function acceptJobCard(file: File | null) {
    setJobCardError(null);
    if (!file) {
      setJobCard(null);
      return;
    }
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setJobCard(null);
      setJobCardError("PDF only.");
      return;
    }
    if (file.size > RTT_JOB_CARD_MAX_BYTES) {
      setJobCard(null);
      setJobCardError("Max size 10 MB.");
      return;
    }
    setJobCard(file);
  }

  function saveEntry() {
    setError(null);
    setSuccess(null);
    const nextErrors: Record<string, string> = {};
    if (!pumpId) nextErrors.pumpId = "Select a pump.";
    if (!volume.trim()) nextErrors.volume = "Enter RTT volume.";
    if (!reason.trim()) nextErrors.reason = "Reason / explanation is required.";
    if (reason.trim().length > RTT_REASON_MAX_CHARS) {
      nextErrors.reason = `Maximum ${RTT_REASON_MAX_CHARS} characters.`;
    }
    if (selectedPump && !selectedPump.linkedTankId) {
      nextErrors.pumpId = "No linked tank for this pump.";
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("stationId", stationId);
      fd.set("pumpId", pumpId);
      fd.set("volumeRaw", volume);
      fd.set("reason", reason);
      fd.set("submissionKey", submissionKey);
      if (jobCard) fd.set("jobCard", jobCard);

      const result = await createRttEventAction(fd);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSuccess("RTT entry saved.");
      clearForm();
      router.refresh();
    });
  }

  function saveCorrection() {
    if (!editEvent) return;
    setError(null);
    startTransition(async () => {
      const result = await correctRttEventAction({
        eventId: editEvent.id,
        volumeRaw: editVolume,
        reason: editReason,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setEditEvent(null);
      setEditVolume("");
      setEditReason("");
      setSuccess("RTT entry corrected.");
      router.refresh();
    });
  }

  const filteredEvents =
    pumpFilter === "ALL" ? events : events.filter((e) => e.pumpKey === pumpFilter);

  return (
    <StockReportingModuleShell
      module="rtt"
      kicker="STOCK SALE REPORTING"
      title="RTT & Truck Calibration"
      subtitle="Record pump test returns (RTT) as they happen and manage truck calibration reconciliation."
    >
      <section className="ssr__summary" aria-label="RTT summary">
        <article className="ssr__summary-card">
          <div className="ssr__summary-inner">
            <span className="ssr__summary-icon">
              <Info size={18} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="ssr__summary-label">Reporting Date</p>
              <p className="ssr__summary-value">{reportingDateLabel}</p>
            </div>
          </div>
        </article>
        <article className="ssr__summary-card">
          <div className="ssr__summary-inner">
            <span className="ssr__summary-icon">
              <Fuel size={18} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="ssr__summary-label">Station</p>
              <p className="ssr__summary-value">{stationName}</p>
            </div>
          </div>
        </article>
        <article className="ssr__summary-card">
          <div className="ssr__summary-inner">
            <span className="ssr__summary-icon">
              <Beaker size={18} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="ssr__summary-label">RTT Events Today</p>
              <p className="ssr__summary-value">
                {totals.eventCount} {totals.eventCount === 1 ? "Event" : "Events"}
              </p>
            </div>
          </div>
        </article>
        <article className="ssr__summary-card">
          <div className="ssr__summary-inner">
            <span className="ssr__summary-icon">
              <Coins size={18} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="ssr__summary-label">Total RTT Volume Today</p>
              <p className="ssr__summary-value">{formatLitresWithUnit(totals.total)}</p>
            </div>
          </div>
        </article>
      </section>

      <div className="ssr-rtt__tabs" role="tablist" aria-label="RTT modules">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rtt"}
          className={cn("ssr-rtt__tab", tab === "rtt" && "is-active")}
          onClick={() => setTab("rtt")}
        >
          <Beaker size={16} strokeWidth={2.25} aria-hidden />
          RTT Recording
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "truck"}
          className={cn("ssr-rtt__tab", tab === "truck" && "is-active")}
          onClick={() => setTab("truck")}
        >
          <Truck size={16} strokeWidth={2.25} aria-hidden />
          Truck Calibration Reconciliation
        </button>
      </div>

      {error ? (
        <p className="ssr__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="ssr-rtt__success" role="status">
          {success}
        </p>
      ) : null}

      {tab === "truck" ? (
        <section className="ssr__card ssr-rtt__empty">
          <span className="ssr-rtt__empty-icon">
            <Truck size={28} strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="ssr__card-title">Truck Calibration Reconciliation</h2>
          <p className="ssr__card-sub">
            Truck calibration reconciliation will be configured in a future update. This tab is a
            placeholder and does not affect RTT, tank dips, or monetary reconciliation.
          </p>
        </section>
      ) : (
        <>
          <div className="ssr-rtt__grid">
            <section className="ssr__card ssr-rtt__form-card" aria-labelledby="rtt-form-title">
              <div className="ssr__card-head">
                <div className="ssr__card-title-row">
                  <span className="ssr__card-icon">
                    <Fuel size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <h2 id="rtt-form-title" className="ssr__card-title">
                      Record New RTT
                    </h2>
                    <p className="ssr__card-sub">
                      Record fuel used for pump testing immediately after the test and return are
                      completed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ssr-rtt__form-layout">
                <div className="ssr-rtt__form-row">
                  <label className="ssr-rtt__field ssr-rtt__field--grow">
                    <span>
                      Pump / Dispenser <span className="ssr-rtt__req">*</span>
                    </span>
                    <select
                      value={pumpId}
                      onChange={(e) => setPumpId(e.target.value)}
                      disabled={pending}
                    >
                      <option value="">Select pump</option>
                      {pumps.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.pumpId ? (
                      <em className="ssr-rtt__field-error">{fieldErrors.pumpId}</em>
                    ) : null}
                  </label>

                  <div
                    className="ssr-rtt__map-panel"
                    role="status"
                    aria-live="polite"
                  >
                    <Info size={16} strokeWidth={2.25} aria-hidden />
                    <div>
                      <p className="ssr-rtt__map-line">
                        Product: <strong>{productTankLabel.product}</strong>
                        <span aria-hidden> | </span>
                        Tank: <strong>{productTankLabel.tank}</strong>
                      </p>
                      <p className="ssr-rtt__map-hint">
                        Automatically set based on the selected pump
                      </p>
                    </div>
                  </div>
                </div>

                <label className="ssr-rtt__field">
                  <span>
                    RTT Volume (L) <span className="ssr-rtt__req">*</span>
                  </span>
                  <input
                    inputMode="decimal"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    disabled={pending}
                    placeholder="e.g. 10.00"
                  />
                  {fieldErrors.volume ? (
                    <em className="ssr-rtt__field-error">{fieldErrors.volume}</em>
                  ) : null}
                </label>

                <label className="ssr-rtt__field">
                  <span>
                    Reason / Explanation <span className="ssr-rtt__req">*</span>
                  </span>
                  <div className="ssr-rtt__textarea-wrap">
                    <textarea
                      value={reason}
                      maxLength={RTT_REASON_MAX_CHARS}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={pending}
                      rows={4}
                      placeholder="e.g. Pump testing after installation, technician maintenance, pump replacement, etc."
                      style={{ width: "100%", resize: "none" }}
                    />
                    <span className="ssr-rtt__char-count">
                      {reason.length} / {RTT_REASON_MAX_CHARS}
                    </span>
                  </div>
                  {fieldErrors.reason ? (
                    <em className="ssr-rtt__field-error">{fieldErrors.reason}</em>
                  ) : null}
                </label>

                <div className="ssr-rtt__field">
                  <span>Job Card (PDF) — Optional</span>
                  <div
                    className={cn(
                      "ssr-rtt__upload",
                      dragOver && "is-drag",
                      (jobCardError || fieldErrors.jobCard) && "is-error"
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      acceptJobCard(e.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    {jobCard ? (
                      <div className="ssr-rtt__upload-file">
                        <FileText size={22} strokeWidth={2} aria-hidden />
                        <div className="ssr-rtt__upload-file-meta">
                          <strong>{jobCard.name}</strong>
                          <span>{formatFileSize(jobCard.size)}</span>
                        </div>
                        <button
                          type="button"
                          className="ssr-rtt__upload-remove"
                          disabled={pending}
                          onClick={() => acceptJobCard(null)}
                          aria-label="Remove job card"
                        >
                          <Trash2 size={16} strokeWidth={2.25} aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={22} strokeWidth={2} aria-hidden />
                        <div className="ssr-rtt__upload-copy">
                          <strong>Upload job card (PDF)</strong>
                          <span>Max size: 10 MB • PDF only</span>
                        </div>
                        <button
                          type="button"
                          className="ssr-rtt__upload-btn"
                          disabled={pending}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose File
                        </button>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={pending}
                      onChange={(e) => acceptJobCard(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {jobCardError || fieldErrors.jobCard ? (
                    <em className="ssr-rtt__field-error">
                      {jobCardError || fieldErrors.jobCard}
                    </em>
                  ) : null}
                </div>
              </div>

              <div className="ssr-rtt__form-actions">
                <button
                  type="button"
                  className="ssr__btn ssr__btn--primary"
                  disabled={pending}
                  onClick={saveEntry}
                >
                  {pending ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Plus size={16} strokeWidth={2.5} aria-hidden />
                  )}
                  Save RTT Entry
                </button>
                <button
                  type="button"
                  className="ssr__btn ssr__btn--ghost"
                  disabled={pending}
                  onClick={clearForm}
                >
                  Clear
                </button>
              </div>
            </section>

            <section className="ssr__card" aria-labelledby="rtt-by-pump-title">
              <div className="ssr__card-head">
                <div className="ssr__card-title-row">
                  <span className="ssr__card-icon">
                    <Fuel size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                  <div>
                    <h2 id="rtt-by-pump-title" className="ssr__card-title">
                      Today&apos;s RTT by Pump
                    </h2>
                    <p className="ssr__card-sub">Cumulative RTT for the reporting date.</p>
                  </div>
                </div>
              </div>

              <div className="ssr__table-wrap">
                <table className="ssr__table">
                  <thead>
                    <tr>
                      <th scope="col">Pump / Dispenser</th>
                      <th scope="col">Product</th>
                      <th scope="col">Linked Tank</th>
                      <th scope="col" className="is-num">
                        RTT (L)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((row) => (
                      <tr key={row.pumpKey}>
                        <td>
                          <span className="ssr-rtt__pump">
                            <Fuel size={14} strokeWidth={2.25} aria-hidden />
                            {row.label}
                          </span>
                        </td>
                        <td>
                          <span
                            className={cn(
                              "ssr-rtt__badge",
                              row.product === "PMS"
                                ? "ssr-rtt__badge--pms"
                                : "ssr-rtt__badge--ago"
                            )}
                          >
                            {row.product}
                          </span>
                        </td>
                        <td>{row.tankLabel ?? "—"}</td>
                        <td className="is-num">{formatLitresFixed(row.totalRttLitres)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ssr-rtt__totals" aria-label="RTT product totals">
                <article className="ssr-rtt__total ssr-rtt__total--pms">
                  <Fuel size={16} strokeWidth={2} aria-hidden />
                  <div>
                    <p>Total PMS RTT</p>
                    <strong>{formatLitresWithUnit(totals.totalPms)}</strong>
                  </div>
                </article>
                <article className="ssr-rtt__total ssr-rtt__total--ago">
                  <Fuel size={16} strokeWidth={2} aria-hidden />
                  <div>
                    <p>Total AGO RTT</p>
                    <strong>{formatLitresWithUnit(totals.totalAgo)}</strong>
                  </div>
                </article>
                <article className="ssr-rtt__total ssr-rtt__total--all">
                  <Layers size={16} strokeWidth={2} aria-hidden />
                  <div>
                    <p>Total RTT</p>
                    <strong>{formatLitresWithUnit(totals.total)}</strong>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <section className="ssr__card" aria-labelledby="rtt-log-title">
            <div className="ssr__recent-head">
              <div>
                <h2 id="rtt-log-title" className="ssr__card-title">
                  RTT Activity Log
                </h2>
                <p className="ssr__card-sub">
                  All RTT entries recorded for the reporting date.
                </p>
              </div>
              <div className="ssr-rtt__log-filters">
                <label>
                  <span className="sr-only">Filter by pump</span>
                  <select
                    value={pumpFilter}
                    onChange={(e) => setPumpFilter(e.target.value)}
                  >
                    <option value="ALL">All Pumps</option>
                    {pumps.map((p) => (
                      <option key={p.pumpKey} value={p.pumpKey}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Reporting date</span>
                  <input type="text" readOnly value={reportingDateLabel} />
                </label>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="ssr-rtt__log-empty">
                <span className="ssr-rtt__empty-icon">
                  <ClipboardList size={28} strokeWidth={1.75} aria-hidden />
                </span>
                <strong>No RTT entries yet</strong>
                <p>Record pump test returns above as they happen during the shift.</p>
              </div>
            ) : (
              <div className="ssr__table-wrap">
                <table className="ssr__table">
                  <thead>
                    <tr>
                      <th scope="col">Date &amp; Time</th>
                      <th scope="col">Pump</th>
                      <th scope="col">Product</th>
                      <th scope="col" className="is-num">
                        RTT (L)
                      </th>
                      <th scope="col">Reason</th>
                      <th scope="col">Job Card</th>
                      <th scope="col">Recorded By</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((e) => (
                      <tr key={e.id}>
                        <td>{formatEventDateTime(e.eventAt)}</td>
                        <td>{e.pumpLabel}</td>
                        <td>
                          <span
                            className={cn(
                              "ssr-rtt__badge",
                              e.product === "PMS"
                                ? "ssr-rtt__badge--pms"
                                : "ssr-rtt__badge--ago"
                            )}
                          >
                            {e.product}
                          </span>
                        </td>
                        <td className="is-num">{formatLitresFixed(e.volumeLitres)}</td>
                        <td className="ssr-rtt__reason-cell">{e.notes ?? "—"}</td>
                        <td>
                          {e.hasJobCard ? (
                            <a
                              className="ssr__view"
                              href={`/api/stock-reporting/rtt/${e.id}/job-card`}
                            >
                              <Download size={14} strokeWidth={2.25} aria-hidden />
                              {e.jobCardFileName ?? "PDF"}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{shortName(e.recordedByName)}</td>
                        <td>
                          <div className="ssr-rtt__row-actions">
                            <button
                              type="button"
                              className="ssr__view"
                              onClick={() => {
                                setEditEvent(e);
                                setEditVolume(formatLitresFixed(e.volumeLitres));
                                setEditReason("");
                              }}
                            >
                              <Pencil size={14} strokeWidth={2.25} aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ssr__view"
                              onClick={() => setViewEvent(e)}
                            >
                              <Eye size={14} strokeWidth={2.25} aria-hidden />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {viewEvent ? (
        <div className="ssr__dialog-backdrop" role="presentation">
          <div className="ssr__dialog" role="dialog" aria-labelledby="rtt-view-title">
            <h3 id="rtt-view-title">RTT entry details</h3>
            <dl className="ssr-rtt__detail">
              <div>
                <dt>Date &amp; Time</dt>
                <dd>{formatEventDateTime(viewEvent.eventAt)}</dd>
              </div>
              <div>
                <dt>Pump</dt>
                <dd>{viewEvent.pumpLabel}</dd>
              </div>
              <div>
                <dt>Product</dt>
                <dd>{viewEvent.product}</dd>
              </div>
              <div>
                <dt>Tank</dt>
                <dd>{viewEvent.tankLabel ?? "—"}</dd>
              </div>
              <div>
                <dt>Volume</dt>
                <dd>{formatLitresWithUnit(viewEvent.volumeLitres)}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{viewEvent.notes ?? "—"}</dd>
              </div>
              <div>
                <dt>Job card</dt>
                <dd>
                  {viewEvent.hasJobCard ? (
                    <a href={`/api/stock-reporting/rtt/${viewEvent.id}/job-card`}>
                      {viewEvent.jobCardFileName ?? "Download PDF"}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Recorded by</dt>
                <dd>{viewEvent.recordedByName ?? viewEvent.recordedById}</dd>
              </div>
            </dl>
            <div className="ssr__dialog-actions">
              <button
                type="button"
                className="ssr__btn ssr__btn--ghost"
                onClick={() => setViewEvent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editEvent ? (
        <div className="ssr__dialog-backdrop" role="presentation">
          <div className="ssr__dialog" role="dialog" aria-labelledby="rtt-edit-title">
            <div className="ssr-rtt__dialog-head">
              <h3 id="rtt-edit-title">Correct RTT entry</h3>
              <button
                type="button"
                className="ssr-rtt__dialog-close"
                aria-label="Close"
                onClick={() => setEditEvent(null)}
              >
                <X size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <p>
              Corrections preserve the original volume and require a reason. Closed reporting days
              cannot be silently changed.
            </p>
            <label className="ssr-rtt__field">
              <span>Corrected volume (L)</span>
              <input
                inputMode="decimal"
                value={editVolume}
                onChange={(e) => setEditVolume(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="ssr-rtt__field" style={{ marginTop: "0.75rem" }}>
              <span>Correction reason</span>
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                disabled={pending}
                placeholder="Why is this being corrected?"
              />
            </label>
            <div className="ssr__dialog-actions">
              <button
                type="button"
                className="ssr__btn ssr__btn--ghost"
                disabled={pending}
                onClick={() => setEditEvent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ssr__btn ssr__btn--primary"
                disabled={pending}
                onClick={saveCorrection}
              >
                {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                Save correction
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="ssr-rtt__footnote">
        <Info size={14} strokeWidth={2.25} aria-hidden />
        RTT entries apply automatically to Pump Meter Readings for{" "}
        <time dateTime={reportingDateIso}>{reportingDateLabel}</time>.{" "}
        <Link href="/dealer/stock-reporting/pump-meters">Open pump meters</Link>
      </p>
    </StockReportingModuleShell>
  );
}
