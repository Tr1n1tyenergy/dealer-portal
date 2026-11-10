"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StockReportingModuleShell } from "./stock-reporting-module-shell";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Format `YYYY-MM-DD` → `01 Oct 2026` to match the mockup. */
function formatIsoDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export type ReportRecordRow = {
  id: string;
  reportingDateLabel: string;
  pumps: number | null;
  tanks: number | null;
  meterSalesLabel: string;
  tankSalesLabel: string;
  expectedRevenueLabel: string;
  collectionsLabel: string;
  status: "DRAFT" | "CLOSED";
  resumeHref: string | null;
  viewHref: string;
  detailsHref: string;
};

function buildQuery(base: {
  stationId?: string;
  status: string;
  date: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (base.stationId) params.set("stationId", base.stationId);
  if (base.status && base.status !== "ALL") params.set("status", base.status);
  if (base.date) params.set("date", base.date);
  if (base.page && base.page > 1) params.set("page", String(base.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function ReportRecordsPageView({
  stationId,
  stationName,
  status,
  date,
  page,
  pageSize,
  total,
  rows,
}: {
  stationId?: string;
  stationName: string | null;
  status: "ALL" | "DRAFT" | "CLOSED";
  date: string;
  page: number;
  pageSize: number;
  total: number;
  rows: ReportRecordRow[];
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(date);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = Math.min(page * pageSize, total);
  const dateLabel = dateDraft ? formatIsoDisplay(dateDraft) : "Select date";

  const exportHref = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    if (stationId) params.set("stationId", stationId);
    if (status !== "ALL") params.set("status", status);
    if (date) params.set("date", date);
    params.set("format", format);
    return `/api/stock-reporting/records/export?${params.toString()}`;
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const window = 5;
    let start = Math.max(1, page - Math.floor(window / 2));
    const end = Math.min(totalPages, start + window - 1);
    start = Math.max(1, end - window + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <StockReportingModuleShell
      module="records"
      kicker="DEALER PORTAL"
      title="Report records"
      subtitle="View all stock sale reports for your station."
    >
      <section className="ssr__card ssr-records" aria-labelledby="ssr-records-title">
        <div className="ssr-records__head">
          <div className="ssr-records__title-row">
            <span className="ssr__card-icon" aria-hidden>
              <ClipboardList size={18} strokeWidth={2.25} />
            </span>
            <div>
              <h2 id="ssr-records-title" className="ssr__card-title">
                Report records
              </h2>
              <p className="ssr__card-sub">
                {stationName
                  ? "A record of all stock sale reports created for this station."
                  : "No station available for this account."}
              </p>
            </div>
          </div>

          <div className="ssr-records__export">
            <button
              type="button"
              className="ssr-records__export-btn"
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!stationId || total === 0}
            >
              <Download size={15} strokeWidth={2.25} aria-hidden />
              Export
              <ChevronDown size={15} strokeWidth={2.25} aria-hidden />
            </button>
            {exportOpen ? (
              <div className="ssr-records__export-menu" role="menu">
                <a
                  role="menuitem"
                  href={exportHref("xlsx")}
                  className="ssr-records__export-item"
                  onClick={() => setExportOpen(false)}
                >
                  <FileSpreadsheet size={16} strokeWidth={2.25} aria-hidden />
                  Export to Excel (.xlsx)
                </a>
                <a
                  role="menuitem"
                  href={exportHref("csv")}
                  className="ssr-records__export-item"
                  onClick={() => setExportOpen(false)}
                >
                  <FileSpreadsheet size={16} strokeWidth={2.25} aria-hidden />
                  Export to CSV (.csv)
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <form className="ssr-records__filters" method="get">
          {stationId ? <input type="hidden" name="stationId" value={stationId} /> : null}
          <label className="ssr-records__field ssr-records__field--date">
            <span>Reporting date</span>
            <div className="ssr-records__date-range">
              <CalendarDays size={16} strokeWidth={2} aria-hidden />
              <span className="ssr-records__date-label" aria-hidden>
                {dateLabel}
              </span>
              <input
                type="date"
                name="date"
                value={dateDraft}
                aria-label="Reporting date"
                className="ssr-records__date-input"
                onChange={(e) => setDateDraft(e.target.value)}
              />
            </div>
          </label>
          <label className="ssr-records__field ssr-records__field--status">
            <span>Status</span>
            <select name="status" defaultValue={status} className="ssr-records__status">
              <option value="ALL">All</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
          <div className="ssr-records__filter-actions">
            <button type="submit" className="ssr-records__apply">
              Apply
            </button>
            <Link
              href={`/dealer/stock-reporting/records${stationId ? `?stationId=${stationId}` : ""}`}
              className="ssr-records__clear"
            >
              Clear
            </Link>
          </div>
        </form>

        {total === 0 ? (
          <div className="ssr__empty">
            <strong>
              {date || status !== "ALL"
                ? "No reports match your filters."
                : "No reports found"}
            </strong>
            {date || status !== "ALL" ? (
              <>
                Try another reporting date or status, or{" "}
                <Link
                  href={`/dealer/stock-reporting/records${stationId ? `?stationId=${stationId}` : ""}`}
                >
                  clear filters
                </Link>
                .
              </>
            ) : (
              <>
                Reports appear after you start a daily stock report.{" "}
                <Link href="/dealer/stock-reporting">Go to stock reporting</Link>.
              </>
            )}
          </div>
        ) : (
          <>
            <div className="ssr__table-wrap">
              <table className="ssr__table ssr-records__table">
                <thead>
                  <tr>
                    <th scope="col">
                      Reporting date <span aria-hidden>↓</span>
                    </th>
                    <th scope="col">Pumps</th>
                    <th scope="col">Tanks</th>
                    <th scope="col" className="is-num">
                      Meter sales (L)
                    </th>
                    <th scope="col" className="is-num">
                      Tank sales (L)
                    </th>
                    <th scope="col" className="is-num">
                      Expected revenue (KES)
                    </th>
                    <th scope="col" className="is-num">
                      Collections (KES)
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="ssr__date-cell">
                          <CalendarDays size={14} strokeWidth={2} aria-hidden />
                          {r.reportingDateLabel}
                        </span>
                      </td>
                      <td>{r.pumps ?? "—"}</td>
                      <td>{r.tanks ?? "—"}</td>
                      <td className="is-num">{r.meterSalesLabel}</td>
                      <td className="is-num">{r.tankSalesLabel}</td>
                      <td className="is-num">{r.expectedRevenueLabel}</td>
                      <td className="is-num">{r.collectionsLabel}</td>
                      <td>
                        {r.status === "CLOSED" ? (
                          <span className="ssr__pill ssr__pill--closed">
                            <Check size={12} strokeWidth={2.5} aria-hidden />
                            Closed
                          </span>
                        ) : (
                          <span className="ssr__pill ssr__pill--draft">
                            Draft
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="ssr-records__row-actions">
                          {r.status === "DRAFT" && r.resumeHref ? (
                            <Link href={r.resumeHref} className="ssr__view">
                              <Pencil size={15} strokeWidth={2.25} aria-hidden />
                              Resume
                            </Link>
                          ) : null}
                          {r.status === "CLOSED" ? (
                            <Link href={r.viewHref} className="ssr__view">
                              <Eye size={15} strokeWidth={2.25} aria-hidden />
                              View
                            </Link>
                          ) : (
                            <Link href={r.detailsHref} className="ssr__view">
                              <Eye size={15} strokeWidth={2.25} aria-hidden />
                              Details
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ssr-records__pager">
              <p className="ssr-records__pager-meta">
                Showing {fromIdx} – {toIdx} of {total} report{total === 1 ? "" : "s"}.
              </p>
              <nav className="ssr-records__pager-nav" aria-label="Report records pages">
                <Link
                  href={`/dealer/stock-reporting/records${buildQuery({
                    stationId,
                    status,
                    date,
                    page: Math.max(1, page - 1),
                  })}`}
                  className={cn("ssr-records__page-btn", page <= 1 && "is-disabled")}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                >
                  <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
                </Link>
                {pageNumbers.map((n) => (
                  <Link
                    key={n}
                    href={`/dealer/stock-reporting/records${buildQuery({
                      stationId,
                      status,
                      date,
                      page: n,
                    })}`}
                    className={cn("ssr-records__page-num", n === page && "is-active")}
                    aria-current={n === page ? "page" : undefined}
                  >
                    {n}
                  </Link>
                ))}
                <Link
                  href={`/dealer/stock-reporting/records${buildQuery({
                    stationId,
                    status,
                    date,
                    page: Math.min(totalPages, page + 1),
                  })}`}
                  className={cn(
                    "ssr-records__page-btn",
                    page >= totalPages && "is-disabled"
                  )}
                  aria-disabled={page >= totalPages}
                  tabIndex={page >= totalPages ? -1 : undefined}
                >
                  <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                </Link>
              </nav>
            </div>
          </>
        )}

      </section>
    </StockReportingModuleShell>
  );
}
