"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Cylinder,
  FileText,
  Fuel,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { StationPricingRow, StationTankSummary } from "@/lib/settings/stations-pricing";
import {
  createTankAction,
  deleteTankAction,
  updateTankAction,
  type TankFuel,
} from "@/lib/settings/tank-actions";

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

function nextPreviewLabel(tanks: StationTankSummary[], product: TankFuel) {
  let max = 0;
  const keyRe = new RegExp(`^${product}-(\\d+)$`, "i");
  const labelRe = new RegExp(`^${product}\\s+Tank\\s+(\\d+)$`, "i");
  for (const t of tanks) {
    if (t.product !== product) continue;
    const km = t.tankKey.match(keyRe);
    if (km) max = Math.max(max, Number(km[1]));
    const lm = t.label.match(labelRe);
    if (lm) max = Math.max(max, Number(lm[1]));
  }
  return `${product} Tank ${max + 1}`;
}

export function TankManagementPanel({
  stations,
  canAct,
  initialStationId,
}: {
  stations: StationPricingRow[];
  canAct: boolean;
  initialStationId?: string;
}) {
  const router = useRouter();
  const [stationId, setStationId] = useState(
    initialStationId && stations.some((s) => s.id === initialStationId)
      ? initialStationId
      : stations[0]?.id ?? ""
  );
  const [innerTab, setInnerTab] = useState<"tanks" | "details">("tanks");
  const [modal, setModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [editTank, setEditTank] = useState<StationTankSummary | null>(null);
  const [fuel, setFuel] = useState<TankFuel>("PMS");
  const [capacity, setCapacity] = useState("30000");
  const [editCapacity, setEditCapacity] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const station = stations.find((s) => s.id === stationId) ?? stations[0] ?? null;

  useEffect(() => {
    if (!station && stations[0]) setStationId(stations[0].id);
  }, [station, stations]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (modal !== "create" && modal !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestCloseModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, dirty]);

  const tanks = station?.tanks ?? [];
  const activeTanks = useMemo(() => tanks.filter((t) => t.active), [tanks]);
  const pmsCount = activeTanks.filter((t) => t.product === "PMS").length;
  const agoCount = activeTanks.filter((t) => t.product === "AGO").length;
  const previewName = station ? nextPreviewLabel(tanks, fuel) : "—";

  function openCreate() {
    if (!canAct || !station) return;
    setError(null);
    setFuel("PMS");
    setCapacity("30000");
    setDirty(false);
    setModal("create");
  }

  function openEdit(t: StationTankSummary) {
    if (!canAct) return;
    setEditTank(t);
    setEditCapacity(String(Math.round(t.capacityLitres)));
    setEditStatus(t.active ? "ACTIVE" : "INACTIVE");
    setError(null);
    setDirty(false);
    setModal("edit");
  }

  function openDelete(t: StationTankSummary) {
    if (!canAct) return;
    setEditTank(t);
    setError(null);
    setModal("delete");
  }

  function requestCloseModal() {
    if (dirty && (modal === "create" || modal === "edit")) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    setModal(null);
    setEditTank(null);
    setError(null);
    setDirty(false);
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!station) return;
    setError(null);
    const fd = new FormData();
    fd.set("stationId", station.id);
    fd.set("product", fuel);
    fd.set("capacityLitres", capacity.replace(/,/g, ""));
    startTransition(async () => {
      const result = await createTankAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setDirty(false);
      setToast(`Tank created successfully. ${result.label} has been added to ${station.name}.`);
      router.refresh();
    });
  }

  function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTank) return;
    setError(null);
    const fd = new FormData();
    fd.set("tankId", editTank.id);
    fd.set("capacityLitres", editCapacity.replace(/,/g, ""));
    fd.set("status", editStatus);
    startTransition(async () => {
      const result = await updateTankAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setDirty(false);
      setToast(`${editTank.label} updated.`);
      router.refresh();
    });
  }

  function onDelete() {
    if (!editTank || !station) return;
    setError(null);
    const fd = new FormData();
    fd.set("tankId", editTank.id);
    startTransition(async () => {
      const result = await deleteTankAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModal(null);
      setToast(
        result.mode === "deactivated"
          ? `${editTank.label} was deactivated because it is linked to operational records.`
          : `${editTank.label} deleted from ${station.name}.`
      );
      router.refresh();
    });
  }

  if (!stations.length) {
    return (
      <div className="ps-empty">
        <strong>No stations available</strong>
        <p>Create a station in Stations & Pricing before managing tanks.</p>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="ps-empty">
        <strong>Select a station</strong>
        <p>Choose a station to view and manage its tanks.</p>
      </div>
    );
  }

  return (
    <>
      <div className="ps-panel__head">
        <span className="ps-panel__ico" aria-hidden>
          <Cylinder size={18} strokeWidth={2.1} />
        </span>
        <div className="ps-panel__copy">
          <h2>Tank Management</h2>
          <p>
            View, create, and manage fuel tanks for each station. Tanks are numbered automatically by fuel
            type (PMS/AGO) per station.
          </p>
        </div>
        {canAct ? (
          <button type="button" className="ps-btn ps-btn--gold" onClick={openCreate}>
            <Plus size={16} strokeWidth={2.4} /> Create Tank
          </button>
        ) : null}
      </div>

      <div className="tm-top">
        <label className="tm-station">
          <span className="tm-station__label">Select Station</span>
          <span className="tm-station__control">
            <MapPin size={15} aria-hidden className="tm-station__pin" />
            <span className="tm-station__value" aria-hidden>
              <strong>{station.name}</strong>
              <small>{station.locationLabel}</small>
            </span>
            <select
              value={station.id}
              onChange={(e) => {
                setStationId(e.target.value);
                setInnerTab("tanks");
              }}
              aria-label="Select station"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.locationLabel ? ` — ${s.locationLabel}` : ""}
                </option>
              ))}
            </select>
          </span>
        </label>

        <div className="tm-stats" aria-label="Tank statistics">
          <div className="tm-stat">
            <span className="tm-stat__ico tm-stat__ico--total" aria-hidden>
              <Cylinder size={15} />
            </span>
            <div>
              <div className="tm-stat__value">{activeTanks.length}</div>
              <div className="tm-stat__label">Total Tanks</div>
            </div>
          </div>
          <div className="tm-stat">
            <span className="tm-stat__ico tm-stat__ico--pms" aria-hidden>
              <Fuel size={15} />
            </span>
            <div>
              <div className="tm-stat__value">{pmsCount}</div>
              <div className="tm-stat__label">PMS Tanks</div>
            </div>
          </div>
          <div className="tm-stat">
            <span className="tm-stat__ico tm-stat__ico--ago" aria-hidden>
              <Fuel size={15} />
            </span>
            <div>
              <div className="tm-stat__value">{agoCount}</div>
              <div className="tm-stat__label">AGO Tanks</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tm-tabs" role="tablist" aria-label="Tank views">
        <button
          type="button"
          role="tab"
          aria-selected={innerTab === "tanks"}
          className={`tm-tab${innerTab === "tanks" ? " is-active" : ""}`}
          onClick={() => setInnerTab("tanks")}
        >
          Tanks ({activeTanks.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={innerTab === "details"}
          className={`tm-tab${innerTab === "details" ? " is-active" : ""}`}
          onClick={() => setInnerTab("details")}
        >
          Station Details
        </button>
      </div>

      {innerTab === "details" ? (
        <div className="tm-details">
          <div className="tm-details__row">
            <strong>Station</strong>
            <span>{station.name}</span>
          </div>
          <div className="tm-details__row">
            <strong>Code</strong>
            <span>{station.code ?? "—"}</span>
          </div>
          <div className="tm-details__row">
            <strong>Location</strong>
            <span>{station.locationLabel}</span>
          </div>
          <div className="tm-details__row">
            <strong>Dealer</strong>
            <span>{station.dealerName}</span>
          </div>
          <div className="tm-details__row">
            <strong>Trading name</strong>
            <span>{station.tradingName ?? "—"}</span>
          </div>
          <div className="tm-details__row">
            <strong>Active tanks</strong>
            <span>{activeTanks.length}</span>
          </div>
        </div>
      ) : tanks.length === 0 ? (
        <div className="ps-empty">
          <strong>No tanks configured for this station.</strong>
          <p>Create the first tank to begin capacity tracking for {station.name}.</p>
          {canAct ? (
            <button type="button" className="ps-btn ps-btn--gold" onClick={openCreate}>
              <Plus size={16} /> Create Tank
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ps-table-wrap">
          <table className="ps-table tm-table">
            <thead>
              <tr>
                <th>Tank Name</th>
                <th>Fuel Type</th>
                <th>Capacity (Liters)</th>
                <th>Status</th>
                <th>Created On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tanks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="tm-name">
                      <FileText size={14} aria-hidden />
                      {t.label}
                    </span>
                  </td>
                  <td>
                    <span className={`ps-fuel ps-fuel--${String(t.product).toLowerCase() === "ago" ? "ago" : "pms"}`}>
                      {t.product}
                    </span>
                  </td>
                  <td className="ps-num">{Math.round(t.capacityLitres).toLocaleString()}</td>
                  <td>
                    <span className={`tm-status${t.active ? " tm-status--active" : " tm-status--inactive"}`}>
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="ps-num--muted" style={{ whiteSpace: "nowrap" }}>
                    {formatWhen(t.createdAt)}
                  </td>
                  <td>
                    <div className="ps-actions">
                      {canAct ? (
                        <>
                          <button type="button" className="ps-btn ps-btn--ghost" onClick={() => openEdit(t)}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button type="button" className="tm-btn-del" onClick={() => openDelete(t)}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      ) : (
                        <span className="ps-num--muted">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast ? <div className="tm-toast" role="status">{toast}</div> : null}

      {modal === "create" ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-create-title">
          <div className="ps-modal__card tm-modal__card tm-modal__card--form">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico" aria-hidden>
                <Cylinder size={20} strokeWidth={2.05} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="tm-create-title">Create Tank</h3>
                <p>Add a new tank for {station.name} station.</p>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={requestCloseModal}>
                <X size={18} strokeWidth={2.1} />
              </button>
            </div>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <form className="tm-modal__form" onSubmit={onCreate}>
              <fieldset className="tm-fuel" disabled={pending}>
                <legend className="tm-field__label">Fuel Type</legend>
                <div className="tm-fuel__opts">
                  {(
                    [
                      { id: "PMS", label: "PMS (Petrol)", Icon: Fuel },
                      { id: "AGO", label: "AGO (Diesel)", Icon: Fuel },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`tm-fuel__opt tm-fuel__opt--${opt.id.toLowerCase()}${fuel === opt.id ? " is-selected" : ""}`}
                      onClick={() => {
                        setFuel(opt.id);
                        setDirty(true);
                      }}
                      aria-pressed={fuel === opt.id}
                    >
                      <span className="tm-fuel__radio" aria-hidden />
                      <opt.Icon size={16} strokeWidth={2.1} aria-hidden />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="tm-field">
                <span className="tm-field__label">
                  Capacity (Liters) <span className="sp-req">*</span>
                </span>
                <input
                  className="tm-field__control"
                  inputMode="numeric"
                  value={capacity}
                  onChange={(e) => {
                    setCapacity(e.target.value);
                    setDirty(true);
                  }}
                  required
                  disabled={pending}
                />
              </label>
              <div className="tm-info" role="note">
                The tank will be automatically named <strong>{previewName}</strong> (the next available {fuel}{" "}
                tank for {station.name}).
              </div>
              <div className="ps-modal__actions tm-modal__actions">
                <button type="button" className="ps-btn ps-btn--line" onClick={requestCloseModal} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="ps-btn ps-btn--gold" disabled={pending}>
                  <Plus size={15} strokeWidth={2.4} aria-hidden />
                  {pending ? "Creating…" : "Create Tank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modal === "edit" && editTank ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-edit-title">
          <div className="ps-modal__card tm-modal__card tm-modal__card--form">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico" aria-hidden>
                <Pencil size={18} strokeWidth={2.05} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="tm-edit-title">Edit Tank</h3>
                <p>
                  {editTank.label} · {station.name}
                </p>
              </div>
              <button type="button" className="tm-modal__close" aria-label="Close" onClick={requestCloseModal}>
                <X size={18} strokeWidth={2.1} />
              </button>
            </div>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <form className="tm-modal__form" onSubmit={onEdit}>
              <label className="tm-field">
                <span className="tm-field__label">
                  Capacity (Liters) <span className="sp-req">*</span>
                </span>
                <input
                  className="tm-field__control"
                  inputMode="numeric"
                  value={editCapacity}
                  onChange={(e) => {
                    setEditCapacity(e.target.value);
                    setDirty(true);
                  }}
                  required
                  disabled={pending}
                />
              </label>
              <label className="tm-field">
                <span className="tm-field__label">Status</span>
                <span className="tm-field__select-wrap">
                  <select
                    className="tm-field__control"
                    value={editStatus}
                    onChange={(e) => {
                      setEditStatus(e.target.value as "ACTIVE" | "INACTIVE");
                      setDirty(true);
                    }}
                    disabled={pending}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </span>
              </label>
              <div className="ps-modal__actions tm-modal__actions">
                <button type="button" className="ps-btn ps-btn--line" onClick={requestCloseModal} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="ps-btn ps-btn--gold" disabled={pending}>
                  <Check size={15} strokeWidth={2.4} aria-hidden />
                  {pending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modal === "delete" && editTank ? (
        <div className="ps-modal tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-del-title">
          <div className="ps-modal__card tm-modal__card sp-delete-card">
            <div className="tm-modal__head">
              <span className="ps-panel__ico sp-modal-ico sp-modal-ico--danger" aria-hidden>
                <Trash2 size={18} strokeWidth={2.05} />
              </span>
              <div className="tm-modal__titles">
                <h3 id="tm-del-title">Delete {editTank.label}?</h3>
                <p>
                  This may affect station configuration and stock reporting. If the tank is linked to operational
                  records, it will be deactivated instead of permanently removed.
                </p>
              </div>
              <button
                type="button"
                className="tm-modal__close"
                aria-label="Close"
                onClick={() => setModal(null)}
                disabled={pending}
              >
                <X size={18} strokeWidth={2.1} />
              </button>
            </div>
            {error ? <p className="ps-modal__err">{error}</p> : null}
            <div className="ps-modal__actions tm-modal__actions">
              <button type="button" className="ps-btn ps-btn--line" onClick={() => setModal(null)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="ps-btn ps-btn--danger" onClick={onDelete} disabled={pending}>
                <Trash2 size={14} strokeWidth={2.2} aria-hidden />
                {pending ? "Working…" : "Delete Tank"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
