"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CircleX,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Search,
  Settings2,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import type { StationPricingRow } from "@/lib/settings/stations-pricing";
import type { FleetTruckRow, FleetTruckStatusValue } from "@/lib/settings/fleet-truck-types";
import { computeFleetStats } from "@/lib/settings/fleet-truck-types";
import { formatCapacityDisplay } from "@/lib/settings/truck-compartments";
import {
  createTruckAction,
  deleteTruckAction,
  setTruckStatusAction,
  updateTruckAction,
} from "@/lib/settings/truck-actions";
import { TruckFormModal } from "@/components/staff/truck-form-modal";

type DealerOpt = { id: string; name: string };
type MenuPos = { top: number; left: number; openUp: boolean };

function statusLabel(s: FleetTruckStatusValue) {
  if (s === "MAINTENANCE") return "Maintenance";
  if (s === "INACTIVE") return "Inactive";
  return "Active";
}

export function FleetTrucksPanel({
  trucks,
  stations,
  dealers,
  canAct,
}: {
  trucks: FleetTruckRow[];
  stations: StationPricingRow[];
  dealers: DealerOpt[];
  canAct: boolean;
}) {
  const router = useRouter();
  const [dealerId, setDealerId] = useState("");
  const [stationId, setStationId] = useState("");
  const [status, setStatus] = useState<"ALL" | FleetTruckStatusValue>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(5);
  const [modal, setModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [editTruck, setEditTruck] = useState<FleetTruckRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const menuPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useLayoutEffect(() => {
    if (!menuId) {
      setMenuPos(null);
      return;
    }
    function place() {
      const btn = menuBtnRefs.current.get(menuId!);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = 200;
      const menuH = 148;
      const gap = 6;
      const openUp = r.bottom + gap + menuH > window.innerHeight - 8 && r.top > menuH + gap + 8;
      const top = openUp ? r.top - gap - menuH : r.bottom + gap;
      const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
      setMenuPos({ top, left, openUp });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const btn = menuBtnRefs.current.get(menuId!);
      if (menuPopRef.current?.contains(t) || btn?.contains(t)) return;
      setMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const menuTruck = useMemo(
    () => (menuId ? trucks.find((t) => t.id === menuId) ?? null : null),
    [menuId, trucks]
  );

  const stationOptionsForFilter = useMemo(() => {
    if (!dealerId) return stations;
    return stations.filter((s) => s.dealerOrganizationId === dealerId);
  }, [stations, dealerId]);

  useEffect(() => {
    if (stationId && !stationOptionsForFilter.some((s) => s.id === stationId)) {
      setStationId("");
    }
  }, [stationId, stationOptionsForFilter]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return trucks.filter((t) => {
      if (dealerId && t.dealerOrganizationId !== dealerId) return false;
      if (stationId && t.stationId !== stationId) return false;
      if (status !== "ALL" && t.status !== status) return false;
      if (!query) return true;
      return (
        t.truckNumber.toLowerCase().includes(query) ||
        t.registrationNumber.toLowerCase().includes(query) ||
        t.transportCompanyName.toLowerCase().includes(query) ||
        t.dealerName.toLowerCase().includes(query) ||
        t.stationName.toLowerCase().includes(query) ||
        (t.driverName ?? "").toLowerCase().includes(query) ||
        (t.driverId ?? "").toLowerCase().includes(query)
      );
    });
  }, [trucks, dealerId, stationId, status, q]);

  const stats = useMemo(() => computeFleetStats(filtered), [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / rows));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * rows, safePage * rows);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * rows + 1;
  const to = Math.min(safePage * rows, filtered.length);

  function clearFilters() {
    setDealerId("");
    setStationId("");
    setStatus("ALL");
    setQ("");
    setPage(1);
  }

  function openCreate() {
    if (!canAct) return;
    setError(null);
    setEditTruck(null);
    setModal("create");
  }

  function openEdit(t: FleetTruckRow) {
    if (!canAct) return;
    setEditTruck(t);
    setError(null);
    setMenuId(null);
    setModal("edit");
  }

  function openDelete(t: FleetTruckRow) {
    if (!canAct) return;
    setEditTruck(t);
    setError(null);
    setMenuId(null);
    setModal("delete");
  }

  function toggleActive(t: FleetTruckRow) {
    if (!canAct) return;
    setMenuId(null);
    const next: FleetTruckStatusValue = t.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
    const fd = new FormData();
    fd.set("truckId", t.id);
    fd.set("status", next);
    startTransition(async () => {
      const result = await setTruckStatusAction(fd);
      if (!result.ok) {
        setToast(result.error);
        return;
      }
      setToast(`${t.truckNumber} ${next === "ACTIVE" ? "activated" : "deactivated"}.`);
      router.refresh();
    });
  }

  function closeFormModal() {
    setModal(null);
    setEditTruck(null);
    setError(null);
  }

  function onFormSubmit(payload: {
    transportCompanyName: string;
    registrationNumber: string;
    capacityLitres: number;
    driverName: string;
    driverId: string;
    status: FleetTruckStatusValue;
    compartments: number[];
  }) {
    setError(null);
    const fd = new FormData();
    fd.set("transportCompanyName", payload.transportCompanyName);
    fd.set("registrationNumber", payload.registrationNumber);
    fd.set("capacityLitres", String(payload.capacityLitres));
    fd.set("driverName", payload.driverName);
    fd.set("driverId", payload.driverId);
    fd.set("compartments", JSON.stringify(payload.compartments));

    if (modal === "edit" && editTruck) {
      fd.set("truckId", editTruck.id);
      fd.set("status", payload.status);
      startTransition(async () => {
        const result = await updateTruckAction(fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setModal(null);
        setEditTruck(null);
        setToast(`${editTruck.truckNumber} updated.`);
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      const result = await createTruckAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setToast(`Truck ${result.truckNumber} was created successfully.`);
      router.refresh();
    });
  }

  function onDelete() {
    if (!editTruck) return;
    setError(null);
    const fd = new FormData();
    fd.set("truckId", editTruck.id);
    startTransition(async () => {
      const result = await deleteTruckAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setToast(
        result.mode === "deactivated"
          ? `${editTruck.truckNumber} was deactivated because it appears on order history.`
          : `${editTruck.truckNumber} deleted.`
      );
      router.refresh();
    });
  }

  const hasActiveFilters = Boolean(dealerId || stationId || status !== "ALL" || q.trim());

  return (
    <>
      <div className="ps-panel__head">
        <span className="ps-panel__ico" aria-hidden>
          <Truck size={22} strokeWidth={2.05} />
        </span>
        <div className="ps-panel__copy">
          <h2>Fleet &amp; Trucks</h2>
          <p>
            Manage transport trucks, drivers, and compartment configurations. Create trucks, update capacities,
            and track fleet status.
          </p>
        </div>
        {canAct ? (
          <button type="button" className="ps-btn ps-btn--gold" onClick={openCreate}>
            <Plus size={16} strokeWidth={2.4} /> Create Truck
          </button>
        ) : null}
      </div>

      <div className="ft-filters">
        <label className="ft-field">
          <span>Dealer / Organisation</span>
          <span className="ft-field__control">
            <Briefcase size={14} aria-hidden />
            <select
              value={dealerId}
              onChange={(e) => {
                setDealerId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Dealers</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="ft-field">
          <span>Station</span>
          <span className="ft-field__control">
            <MapPin size={14} aria-hidden />
            <select
              value={stationId}
              onChange={(e) => {
                setStationId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Stations</option>
              {stationOptionsForFilter.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="ft-field">
          <span>Status</span>
          <span className="ft-field__control">
            <Settings2 size={14} aria-hidden />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "ALL" | FleetTruckStatusValue);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </span>
        </label>
        <label className="ft-field ft-field--search">
          <span className="ft-field__sr">Search</span>
          <span className="ft-field__control ft-field__control--search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="Search trucks..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
      </div>

      <div className="ft-stats" aria-label="Fleet statistics">
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--total" aria-hidden>
            <Truck size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{stats.total}</div>
            <div className="ft-stat__label">Total Trucks</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--active" aria-hidden>
            <CheckCircle2 size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{stats.active}</div>
            <div className="ft-stat__label">Active</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--maint" aria-hidden>
            <CirclePause size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{stats.maintenance}</div>
            <div className="ft-stat__label">In Maintenance</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--inactive" aria-hidden>
            <CircleX size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{stats.inactive}</div>
            <div className="ft-stat__label">Inactive</div>
          </div>
        </div>
      </div>

      {trucks.length === 0 ? (
        <div className="ft-empty" role="status">
          <div className="ft-empty__art" aria-hidden>
            <FleetEmptyIllustration />
          </div>
          <h3 className="ft-empty__title">No trucks found</h3>
          <p className="ft-empty__copy">
            There are no trucks in the system yet. Create the first truck to begin managing the dealer fleet.
          </p>
          {canAct ? (
            <button type="button" className="ps-btn ps-btn--gold ft-empty__cta" onClick={openCreate}>
              <Plus size={16} strokeWidth={2.4} /> Create Truck
            </button>
          ) : null}
          <div className="ft-empty__wash" aria-hidden />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ft-empty ft-empty--filtered" role="status">
          <div className="ft-empty__art" aria-hidden>
            <FleetEmptyIllustration muted />
          </div>
          <h3 className="ft-empty__title">No matching trucks</h3>
          <p className="ft-empty__copy">
            No trucks match your current search or filters. Try adjusting your criteria.
          </p>
          {hasActiveFilters ? (
            <button type="button" className="ps-btn ps-btn--line ft-empty__cta" onClick={clearFilters}>
              Clear Filters
            </button>
          ) : null}
          <div className="ft-empty__wash" aria-hidden />
        </div>
      ) : (
        <>
          <div className="ps-table-wrap ft-table-wrap">
            <table className="ps-table ft-table">
              <thead>
                <tr>
                  <th>Truck No. / Registration</th>
                  <th>Transport Company</th>
                  <th>Driver</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr key={t.id} className={menuId === t.id ? "is-menu-open" : undefined}>
                    <td>
                      <span className="ft-id">
                        <span className="ft-id__ico" aria-hidden>
                          <Truck size={14} />
                        </span>
                        <span>
                          <strong>{t.truckNumber}</strong>
                          <small>{t.registrationNumber}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="ft-cell-ico" title={t.transportCompanyName}>
                        <Briefcase size={13} aria-hidden />
                        <span>{t.transportCompanyName}</span>
                      </span>
                    </td>
                    <td>
                      <span className="ft-cell-ico" title={t.driverId ?? undefined}>
                        <User size={13} aria-hidden />
                        <span>
                          <strong className="ft-driver-name">{t.driverName ?? "—"}</strong>
                          {t.driverId ? <small className="ft-driver-id">{t.driverId}</small> : null}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="ft-cap-cell">
                        <strong>{formatCapacityDisplay(t.capacityLitres)}</strong>
                        {t.compartments.length > 0 ? (
                          <small>
                            {t.compartments.length} compartment
                            {t.compartments.length === 1 ? "" : "s"}
                          </small>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <span className={`ft-status ft-status--${t.status.toLowerCase()}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td>
                      <div className="ps-actions ft-actions">
                        {canAct ? (
                          <button
                            type="button"
                            className="ps-icon-btn"
                            ref={(el) => {
                              if (el) menuBtnRefs.current.set(t.id, el);
                              else menuBtnRefs.current.delete(t.id);
                            }}
                            aria-label={`More actions for ${t.truckNumber}`}
                            aria-expanded={menuId === t.id}
                            aria-haspopup="menu"
                            onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                          >
                            <MoreVertical size={14} />
                          </button>
                        ) : (
                          <button type="button" className="ps-icon-btn" aria-label="More actions" disabled>
                            <MoreVertical size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ps-pager ft-pager">
            <span className="ps-pager__info">
              Showing {from} – {to} of {filtered.length} truck{filtered.length === 1 ? "" : "s"}
            </span>
            <label>
              Rows per page:{" "}
              <select
                value={rows}
                onChange={(e) => {
                  setRows(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`ps-page${safePage <= 1 ? " is-disabled" : ""}`}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
              .map((n, i, list) => (
                <span key={n} style={{ display: "inline-flex", gap: 6 }}>
                  {i > 0 && list[i - 1] !== n - 1 ? <span className="ps-page is-disabled">…</span> : null}
                  <button
                    type="button"
                    className="ps-page"
                    aria-current={n === safePage ? "page" : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <button
              type="button"
              className={`ps-page${safePage >= pages ? " is-disabled" : ""}`}
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      {toast ? <div className="tm-toast" role="status">{toast}</div> : null}

      {mounted && menuId && menuPos && menuTruck && canAct
        ? createPortal(
            <div
              ref={menuPopRef}
              className={`sp-actions-menu${menuPos.openUp ? " is-up" : ""}`}
              style={{ top: menuPos.top, left: menuPos.left } satisfies CSSProperties}
              role="menu"
              aria-label={`${menuTruck.truckNumber} actions`}
            >
              <button
                type="button"
                role="menuitem"
                className="sp-actions-menu__item"
                onClick={() => openEdit(menuTruck)}
              >
                <Pencil size={15} strokeWidth={2.1} aria-hidden />
                <span>Edit Truck</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="sp-actions-menu__item"
                onClick={() => toggleActive(menuTruck)}
                disabled={pending}
              >
                <Power size={15} strokeWidth={2.1} aria-hidden />
                <span>{menuTruck.status === "INACTIVE" ? "Activate" : "Deactivate"}</span>
              </button>
              <div className="sp-actions-menu__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="sp-actions-menu__item is-danger"
                onClick={() => openDelete(menuTruck)}
              >
                <Trash2 size={15} strokeWidth={2.1} aria-hidden />
                <span>Delete</span>
              </button>
            </div>,
            document.body
          )
        : null}

      {modal === "create" || modal === "edit" ? (
        <TruckFormModal
          mode={modal}
          truck={editTruck}
          pending={pending}
          error={error}
          onClose={closeFormModal}
          onSubmit={onFormSubmit}
        />
      ) : null}

      {modal === "delete" && editTruck ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="ft-del-title">
          <div className="ps-modal__card tm-modal__card">
            <h3 id="ft-del-title">Delete {editTruck.truckNumber}?</h3>
            <p>
              Registration {editTruck.registrationNumber}. If this plate appears on order history, the truck will
              be deactivated instead of permanently removed.
            </p>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <div className="ps-modal__actions">
              <button type="button" className="ps-btn ps-btn--line" onClick={() => setModal(null)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="tm-btn-del tm-btn-del--solid" onClick={onDelete} disabled={pending}>
                {pending ? "Working…" : "Delete Truck"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Compact truck + clipboard illustration for the Fleet empty state (mockup). */
function FleetEmptyIllustration({ muted = false }: { muted?: boolean }) {
  const blue = muted ? "#9aafd4" : "#3551A5";
  const blueSoft = muted ? "#c5d4ea" : "#6f8fd0";
  const ink = muted ? "#7b8db0" : "#0a235b";
  return (
    <svg
      className="ft-empty__svg"
      viewBox="0 0 220 150"
      width="220"
      height="150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="110" cy="132" rx="72" ry="8" fill="#dbe6f8" opacity="0.7" />
      <path
        d="M28 118c18-10 36-6 52 2 14 7 28 8 44 2 18-7 34-4 48 6"
        stroke="#c9d8f0"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M18 128c22-8 40-4 58 3 16 6 30 5 46-1 20-7 38-3 56 8"
        stroke="#dce6f6"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <rect x="118" y="28" width="64" height="78" rx="8" fill="#fff" stroke={blue} strokeWidth="2.2" />
      <rect x="136" y="22" width="28" height="12" rx="4" fill={blueSoft} stroke={blue} strokeWidth="1.6" />
      <path d="M130 52h40M130 64h40M130 76h28" stroke={blueSoft} strokeWidth="3" strokeLinecap="round" />
      <circle cx="134" cy="52" r="3.2" fill="#1f8a4c" />
      <circle cx="134" cy="64" r="3.2" fill="#1f8a4c" />
      <circle cx="134" cy="76" r="3.2" fill="#1f8a4c" />
      <path d="M132.2 52l1.3 1.3 2.6-2.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M132.2 64l1.3 1.3 2.6-2.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M132.2 76l1.3 1.3 2.6-2.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="34" y="70" width="78" height="36" rx="6" fill="#fff" stroke={blue} strokeWidth="2.2" />
      <path d="M112 78h22c3.5 0 6.5 2.2 7.6 5.5l4.4 12.5H112V78z" fill={blue} />
      <rect x="118" y="84" width="12" height="10" rx="2" fill="#cfe0ff" />
      <rect x="42" y="78" width="22" height="14" rx="2.5" fill="#e8f0ff" stroke={blueSoft} strokeWidth="1.4" />
      <rect x="68" y="78" width="22" height="14" rx="2.5" fill="#e8f0ff" stroke={blueSoft} strokeWidth="1.4" />
      <circle cx="52" cy="112" r="9" fill="#fff" stroke={ink} strokeWidth="2.2" />
      <circle cx="52" cy="112" r="3.5" fill={blueSoft} />
      <circle cx="118" cy="112" r="9" fill="#fff" stroke={ink} strokeWidth="2.2" />
      <circle cx="118" cy="112" r="3.5" fill={blueSoft} />
      <rect x="34" y="102" width="78" height="4" fill={blue} opacity="0.85" />
    </svg>
  );
}
