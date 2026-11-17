"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileText,
  Fuel,
  Layers,
  List,
  MapPin,
  Pencil,
  Presentation,
  Shield,
  Trash2,
  Truck,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import type {
  ActivityFilterOptions,
  ActivityLogRow,
  ActivityQueryInput,
  ActivityStats,
} from "@/lib/settings/activity-log-types";
import { ACTIVITY_ACTION_KINDS, type ActivityActionKind, type ActivityModuleKey } from "@/lib/settings/activity-present";
import { exportActivityLogsAction, queryActivityLogsAction } from "@/lib/settings/activity-actions";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}, ${time}`;
}

function ModuleIcon({ mod, size = 12 }: { mod: ActivityModuleKey; size?: number }) {
  if (mod === "users" || mod === "auth") return <Users size={size} />;
  if (mod === "presentations") return <Presentation size={size} />;
  if (mod === "stations") return <Fuel size={size} />;
  if (mod === "tanks") return <Database size={size} />;
  if (mod === "fleet") return <Truck size={size} />;
  if (mod === "reports") return <FileText size={size} />;
  if (mod === "permissions") return <Shield size={size} />;
  if (mod === "orders") return <Layers size={size} />;
  return <Layers size={size} />;
}

function ActionGlyph({ action, kind }: { action: string; kind: ActivityActionKind }) {
  const a = action.toUpperCase();
  if (kind === "created" || a.includes("CREATE") || a.includes("INVITED") || a.includes("SUBMITTED")) return "+";
  if (kind === "updated" || a.includes("UPDATE") || a.includes("CHANGED")) return "✎";
  if (kind === "deleted") return "⌫";
  if (kind === "login") return "⇢";
  if (kind === "access") return "⚖";
  if (kind === "viewed") return "◉";
  return "•";
}

const EMPTY_STATS: ActivityStats = { total: 0, successful: 0, updates: 0, deletions: 0, access: 0 };

export function ActivityLogsPanel({
  canView,
  filterOptions,
  initial,
}: {
  canView: boolean;
  filterOptions: ActivityFilterOptions | null;
  initial: {
    rows: ActivityLogRow[];
    total: number;
    page: number;
    pageSize: number;
    stats: ActivityStats;
  } | null;
}) {
  const [datePreset, setDatePreset] = useState<ActivityQueryInput["datePreset"]>("7d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actorId, setActorId] = useState("");
  const [module, setModule] = useState<"ALL" | ActivityModuleKey>("ALL");
  const [actionKind, setActionKind] = useState<"ALL" | ActivityActionKind>("ALL");
  const [stationId, setStationId] = useState("");
  const [page, setPage] = useState(initial?.page ?? 1);
  const [pageSize, setPageSize] = useState(initial?.pageSize ?? 8);
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [rows, setRows] = useState<ActivityLogRow[]>(initial?.rows ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [stats, setStats] = useState<ActivityStats>(initial?.stats ?? EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActivityLogRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  const queryInput = useMemo<ActivityQueryInput>(
    () => ({
      datePreset,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      actorId: actorId || null,
      module,
      actionKind,
      stationId: stationId || null,
      page,
      pageSize,
      sort,
    }),
    [datePreset, dateFrom, dateTo, actorId, module, actionKind, stationId, page, pageSize, sort]
  );

  function reload(next?: Partial<ActivityQueryInput>) {
    const input = { ...queryInput, ...next };
    startTransition(async () => {
      setError(null);
      const result = await queryActivityLogsAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.data.rows);
      setTotal(result.data.total);
      setStats(result.data.stats);
      setPage(result.data.page);
      setPageSize(result.data.pageSize);
    });
  }

  useEffect(() => {
    if (!canView || !initial) return;
    // Skip first paint when initial matches defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFilterChange(patch: Partial<ActivityQueryInput> & { resetPage?: boolean }) {
    const { resetPage = true, ...rest } = patch;
    if (rest.datePreset != null) setDatePreset(rest.datePreset);
    if ("dateFrom" in rest) setDateFrom(rest.dateFrom ?? "");
    if ("dateTo" in rest) setDateTo(rest.dateTo ?? "");
    if ("actorId" in rest) setActorId(rest.actorId ?? "");
    if (rest.module != null) setModule(rest.module === "ALL" || rest.module == null ? "ALL" : rest.module);
    if (rest.actionKind != null) {
      setActionKind(rest.actionKind === "ALL" || rest.actionKind == null ? "ALL" : rest.actionKind);
    }
    if ("stationId" in rest) setStationId(rest.stationId ?? "");
    if (rest.sort) setSort(rest.sort);
    if (rest.pageSize) setPageSize(rest.pageSize);
    const nextPage = resetPage ? 1 : (rest.page ?? page);
    if (resetPage) setPage(1);
    reload({ ...rest, page: nextPage });
  }

  function clearFilters() {
    setDatePreset("7d");
    setDateFrom("");
    setDateTo("");
    setActorId("");
    setModule("ALL");
    setActionKind("ALL");
    setStationId("");
    setPage(1);
    reload({
      datePreset: "7d",
      dateFrom: null,
      dateTo: null,
      actorId: null,
      module: "ALL",
      actionKind: "ALL",
      stationId: null,
      page: 1,
    });
  }

  async function onExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await exportActivityLogsAction({ ...queryInput, page: 1, pageSize: 8 });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const hasFilters =
    datePreset !== "7d" || Boolean(actorId || stationId || dateFrom || dateTo) || module !== "ALL" || actionKind !== "ALL";

  if (!canView) {
    return (
      <div className="ps-empty">
        <strong>Access denied</strong>
        <p>You do not have permission to view activity logs.</p>
      </div>
    );
  }

  return (
    <>
      <div className="ps-panel__head">
        <span className="ps-panel__ico" aria-hidden>
          <FileText size={18} strokeWidth={2.1} />
        </span>
        <div className="ps-panel__copy">
          <h2>Activity Logs</h2>
          <p>Track and audit every action taken in the system by all users, across all modules and stations.</p>
        </div>
      </div>

      <div className="al-filters">
        <label className="al-field">
          <span>Date Range</span>
          <span className="al-field__control">
            <Calendar size={14} aria-hidden />
            <select
              value={datePreset}
              onChange={(e) => onFilterChange({ datePreset: e.target.value as ActivityQueryInput["datePreset"] })}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </span>
        </label>
        <label className="al-field">
          <span>User</span>
          <span className="al-field__control">
            <UserRound size={14} aria-hidden />
            <select value={actorId} onChange={(e) => onFilterChange({ actorId: e.target.value || null })}>
              <option value="">All Users</option>
              {(filterOptions?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="al-field">
          <span>Module / Section</span>
          <span className="al-field__control">
            <Database size={14} aria-hidden />
            <select
              value={module}
              onChange={(e) => onFilterChange({ module: e.target.value as "ALL" | ActivityModuleKey })}
            >
              <option value="ALL">All Modules</option>
              {(filterOptions?.modules ?? []).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="al-field">
          <span>Action</span>
          <span className="al-field__control">
            <Zap size={14} aria-hidden />
            <select
              value={actionKind}
              onChange={(e) => onFilterChange({ actionKind: e.target.value as "ALL" | ActivityActionKind })}
            >
              <option value="ALL">All Actions</option>
              {ACTIVITY_ACTION_KINDS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="al-field">
          <span>Station</span>
          <span className="al-field__control">
            <MapPin size={14} aria-hidden />
            <select value={stationId} onChange={(e) => onFilterChange({ stationId: e.target.value || null })}>
              <option value="">All Stations</option>
              {(filterOptions?.stations ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <div className="al-export">
          <button type="button" className="ps-btn ps-btn--gold" onClick={onExport} disabled={exporting || pending}>
            <Download size={15} /> {exporting ? "Exporting…" : "Export Logs"}
          </button>
        </div>
      </div>

      {datePreset === "custom" ? (
        <div className="al-custom-dates">
          <label>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onFilterChange({ dateFrom: e.target.value, datePreset: "custom" })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onFilterChange({ dateTo: e.target.value, datePreset: "custom" })}
            />
          </label>
        </div>
      ) : null}

      <div className={`al-stats${pending ? " is-loading" : ""}`} aria-label="Activity statistics">
        <div className="al-stat">
          <span className="al-stat__ico al-stat__ico--total" aria-hidden>
            <List size={15} />
          </span>
          <div>
            <div className="al-stat__value">{stats.total.toLocaleString()}</div>
            <div className="al-stat__label">Total Activities</div>
          </div>
        </div>
        <div className="al-stat">
          <span className="al-stat__ico al-stat__ico--ok" aria-hidden>
            <CheckCircle2 size={15} />
          </span>
          <div>
            <div className="al-stat__value">{stats.successful.toLocaleString()}</div>
            <div className="al-stat__label">Successful Actions</div>
          </div>
        </div>
        <div className="al-stat">
          <span className="al-stat__ico al-stat__ico--edit" aria-hidden>
            <Pencil size={15} />
          </span>
          <div>
            <div className="al-stat__value">{stats.updates.toLocaleString()}</div>
            <div className="al-stat__label">Updates &amp; Edits</div>
          </div>
        </div>
        <div className="al-stat">
          <span className="al-stat__ico al-stat__ico--del" aria-hidden>
            <Trash2 size={15} />
          </span>
          <div>
            <div className="al-stat__value">{stats.deletions.toLocaleString()}</div>
            <div className="al-stat__label">Deletions</div>
          </div>
        </div>
        <div className="al-stat">
          <span className="al-stat__ico al-stat__ico--access" aria-hidden>
            <Shield size={15} />
          </span>
          <div>
            <div className="al-stat__value">{stats.access.toLocaleString()}</div>
            <div className="al-stat__label">Access &amp; Permissions</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="al-banner">
          <span>{error}</span>
          <button type="button" className="ps-btn ps-btn--line" onClick={() => reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {total === 0 && !pending ? (
        <div className="ps-empty">
          <strong>{hasFilters ? "No activities match the selected filters." : "No activity records found."}</strong>
          <p>
            {hasFilters
              ? "Try a wider date range or clear filters to see more results."
              : "Audited actions across Trinity will appear here as users work in the platform."}
          </p>
          {hasFilters ? (
            <button type="button" className="ps-btn ps-btn--line" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="ps-table-wrap al-table-wrap">
            <table className="ps-table al-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="al-sort"
                      onClick={() => {
                        const next = sort === "desc" ? "asc" : "desc";
                        setSort(next);
                        reload({ sort: next, page: safePage });
                      }}
                    >
                      When {sort === "desc" ? "↓" : "↑"}
                    </button>
                  </th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module / Section</th>
                  <th>Details</th>
                  <th>Station / Context</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="al-when">{formatWhen(r.createdAt)}</td>
                    <td>
                      <span className="al-user">
                        <span className="al-avatar" aria-hidden>
                          {r.actorInitials}
                        </span>
                        <strong title={r.actorEmail ?? undefined}>{r.actorName}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="al-action" title={r.action}>
                        <span className="al-action__glyph" aria-hidden>
                          <ActionGlyph action={r.action} kind={r.actionKind} />
                        </span>
                        {r.action}
                      </span>
                    </td>
                    <td>
                      <span className={`al-mod al-mod--${r.module}`}>
                        <ModuleIcon mod={r.module} />
                        {r.moduleLabel}
                      </span>
                    </td>
                    <td>
                      <span className="al-details" title={r.details}>
                        {r.details}
                      </span>
                    </td>
                    <td className="al-station">{r.stationName ?? "—"}</td>
                    <td>
                      <span className={`al-status al-status--${r.outcome}`}>
                        {r.outcome === "success" ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="al-view"
                        aria-label="View details"
                        title="View details"
                        onClick={() => setDetail(r)}
                      >
                        <Eye size={15} strokeWidth={2.1} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ps-pager">
            <span className="ps-pager__info">
              Showing {from} – {to} of {total.toLocaleString()} activit{total === 1 ? "y" : "ies"}
            </span>
            <label>
              Rows per page:{" "}
              <select
                value={pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPageSize(n);
                  setPage(1);
                  reload({ pageSize: n, page: 1 });
                }}
              >
                {[5, 8, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`ps-page${safePage <= 1 ? " is-disabled" : ""}`}
              disabled={safePage <= 1 || pending}
              onClick={() => {
                const p = Math.max(1, safePage - 1);
                setPage(p);
                reload({ page: p });
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 2)
              .map((n, i, list) => (
                <span key={n} style={{ display: "inline-flex", gap: 6 }}>
                  {i > 0 && list[i - 1] !== n - 1 ? <span className="ps-page is-disabled">…</span> : null}
                  <button
                    type="button"
                    className="ps-page"
                    aria-current={n === safePage ? "page" : undefined}
                    disabled={pending}
                    onClick={() => {
                      setPage(n);
                      reload({ page: n });
                    }}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              type="button"
              className={`ps-page${safePage >= pages ? " is-disabled" : ""}`}
              disabled={safePage >= pages || pending}
              onClick={() => {
                const p = Math.min(pages, safePage + 1);
                setPage(p);
                reload({ page: p });
              }}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      {detail ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="al-detail-title">
          <div className="ps-modal__card tm-modal__card al-detail-card">
            <div className="tm-modal__head">
              <span className="ps-panel__ico" aria-hidden>
                <FileText size={16} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="al-detail-title">Activity Details</h3>
                <p>
                  {detail.action} · {detail.outcome === "success" ? "Success" : "Failed"}
                </p>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={() => setDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="al-detail-grid">
              <div>
                <strong>Event ID</strong>
                <span>{detail.id}</span>
              </div>
              <div>
                <strong>Timestamp</strong>
                <span>{formatWhen(detail.createdAt)}</span>
              </div>
              <div>
                <strong>User</strong>
                <span>
                  {detail.actorName}
                  {detail.actorRole ? ` · ${detail.actorRole}` : ""}
                </span>
              </div>
              <div>
                <strong>Module</strong>
                <span>{detail.moduleLabel}</span>
              </div>
              <div>
                <strong>Action</strong>
                <span>{detail.action}</span>
              </div>
              <div>
                <strong>Station / Context</strong>
                <span>{detail.stationName ?? "—"}</span>
              </div>
              <div>
                <strong>Entity</strong>
                <span>
                  {detail.entity ?? "—"}
                  {detail.entityId ? ` · ${detail.entityId}` : ""}
                </span>
              </div>
              <div className="al-detail-grid__full">
                <strong>Description</strong>
                <span>{detail.details}</span>
              </div>
              {detail.meta.before != null || detail.meta.after != null ? (
                <>
                  <div>
                    <strong>Before</strong>
                    <pre className="al-pre">{JSON.stringify(detail.meta.before, null, 2)}</pre>
                  </div>
                  <div>
                    <strong>After</strong>
                    <pre className="al-pre">{JSON.stringify(detail.meta.after, null, 2)}</pre>
                  </div>
                </>
              ) : null}
              {Object.keys(detail.meta).length > 0 ? (
                <div className="al-detail-grid__full">
                  <strong>Metadata</strong>
                  <pre className="al-pre">{JSON.stringify(detail.meta, null, 2)}</pre>
                </div>
              ) : null}
            </div>
            <div className="ps-modal__actions">
              <button type="button" className="ps-btn ps-btn--line" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
