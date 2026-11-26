"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Cylinder,
  IdCard,
  Layers,
  Search,
  Truck,
  User,
  UserRound,
  X,
} from "lucide-react";
import { onGroupedInput, sanitizeNumericText } from "@/lib/forms/numeric-text";
import type { FleetTruckRow, FleetTruckStatusValue } from "@/lib/settings/fleet-truck-types";
import {
  formatCapacityDisplay,
  MAX_COMPARTMENTS,
  MIN_COMPARTMENTS,
  parseLitresInput,
  resolveCompartmentCapacities,
} from "@/lib/settings/truck-compartments";

type Mode = "create" | "edit";

export function TruckFormModal({
  mode,
  truck,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  truck: FleetTruckRow | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    transportCompanyName: string;
    registrationNumber: string;
    capacityLitres: number;
    driverName: string;
    driverId: string;
    status: FleetTruckStatusValue;
    compartments: number[];
  }) => void;
}) {
  const [transportCompanyName, setTransportCompanyName] = useState("");
  const [plates, setPlates] = useState("");
  const [capacityRaw, setCapacityRaw] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [status, setStatus] = useState<FleetTruckStatusValue>("ACTIVE");
  const [compartmentCount, setCompartmentCount] = useState(4);
  const [editableCaps, setEditableCaps] = useState<string[]>(["", "", ""]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (mode === "edit" && truck) {
      setTransportCompanyName(truck.transportCompanyName !== "—" ? truck.transportCompanyName : "");
      setPlates(truck.registrationNumber);
      setCapacityRaw(sanitizeNumericText(String(truck.capacityLitres), true));
      setDriverName(truck.driverName ?? "");
      setDriverId(truck.driverId ?? "");
      setStatus(truck.status);
      const comps =
        truck.compartments.length > 0
          ? truck.compartments
          : [{ compartmentNumber: 1, capacityLitres: truck.capacityLitres, id: "" }];
      const n = Math.min(MAX_COMPARTMENTS, Math.max(MIN_COMPARTMENTS, comps.length));
      setCompartmentCount(n);
      setEditableCaps(comps.slice(0, Math.max(0, n - 1)).map((c) => sanitizeNumericText(String(c.capacityLitres), true)));
    } else {
      setTransportCompanyName("");
      setPlates("");
      setCapacityRaw("10,000");
      setDriverName("");
      setDriverId("");
      setStatus("ACTIVE");
      setCompartmentCount(4);
      setEditableCaps(["2,000", "3,000", "2,000"]);
    }
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, truck?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const capacityLitres = parseLitresInput(capacityRaw) ?? 0;

  const editableParsed = useMemo(
    () => editableCaps.map((v) => parseLitresInput(v)),
    [editableCaps]
  );

  const allocation = useMemo(
    () => resolveCompartmentCapacities(capacityLitres, compartmentCount, editableParsed),
    [capacityLitres, compartmentCount, editableParsed]
  );

  const formValid =
    transportCompanyName.trim().length >= 2 &&
    plates.trim().length >= 5 &&
    capacityLitres > 0 &&
    driverName.trim().length > 0 &&
    driverId.trim().length > 0 &&
    allocation.valid;

  function markDirty() {
    setDirty(true);
  }

  function requestClose() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  }

  function setCompartmentCountSafe(next: number) {
    const n = Math.min(MAX_COMPARTMENTS, Math.max(MIN_COMPARTMENTS, next));
    setCompartmentCount(n);
    setEditableCaps((prev) => {
      const needed = Math.max(0, n - 1);
      const copy = prev.slice(0, needed);
      while (copy.length < needed) copy.push("");
      return copy;
    });
    markDirty();
  }

  const onCapacityChange = onGroupedInput(true, (value) => {
    setCapacityRaw(value);
    markDirty();
  });

  function capacityDisplayValue() {
    return capacityRaw;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid || pending) return;
    onSubmit({
      transportCompanyName: transportCompanyName.trim(),
      registrationNumber: plates,
      capacityLitres,
      driverName: driverName.trim(),
      driverId: driverId.trim(),
      status,
      compartments: allocation.capacities,
    });
  }

  return (
    <div className="ps-modal tm-modal ft-truck-modal" role="dialog" aria-modal="true" aria-labelledby="ft-truck-title">
      <div className="ps-modal__card tm-modal__card ft-truck-modal__card">
        <div className="tm-modal__head">
          <span className="ps-panel__ico ft-truck-modal__ico" aria-hidden>
            <Truck size={16} strokeWidth={2.1} />
          </span>
          <div className="tm-modal__titles">
            <h3 id="ft-truck-title">{mode === "create" ? "Create Truck" : "Edit Truck"}</h3>
            <p>
              {mode === "create"
                ? "Add a new truck with its details and compartment configuration."
                : `${truck?.truckNumber ?? ""} · update details and compartment configuration.`}
            </p>
          </div>
          <button type="button" className="tm-modal__close" aria-label="Close" onClick={requestClose}>
            <X size={18} />
          </button>
        </div>

        {error ? <p className="ps-modal__err">{error}</p> : null}

        <form className="ft-truck-form" onSubmit={submit}>
          <label className="ft-truck-field">
            <span className="ft-truck-field__label">
              Transport Company <abbr title="Required">*</abbr>
            </span>
            <span className="ft-truck-field__control">
              <Briefcase size={15} aria-hidden />
              <input
                type="text"
                value={transportCompanyName}
                required
                disabled={pending}
                placeholder="e.g. Kenbi Logistics Ltd."
                autoComplete="organization"
                onChange={(e) => {
                  setTransportCompanyName(e.target.value);
                  markDirty();
                }}
              />
            </span>
          </label>

          <div className="ft-truck-grid">
            <label className="ft-truck-field">
              <span className="ft-truck-field__label">
                Truck Plates <abbr title="Required">*</abbr>
              </span>
              <span className="ft-truck-field__control">
                <IdCard size={15} aria-hidden />
                <input
                  value={plates}
                  required
                  disabled={pending}
                  placeholder="KDS 640Z"
                  onChange={(e) => {
                    setPlates(e.target.value);
                    markDirty();
                  }}
                />
              </span>
            </label>
            <label className="ft-truck-field">
              <span className="ft-truck-field__label">
                Capacity <abbr title="Required">*</abbr>
              </span>
              <span className="ft-truck-field__control">
                <Cylinder size={15} aria-hidden />
                <input
                  inputMode="decimal"
                  value={capacityDisplayValue()}
                  required
                  disabled={pending}
                  placeholder="10,000 L (10 m³)"
                  onChange={onCapacityChange}
                />
              </span>
            </label>
            <label className="ft-truck-field">
              <span className="ft-truck-field__label">
                Driver Name <abbr title="Required">*</abbr>
              </span>
              <span className="ft-truck-field__control">
                <User size={15} aria-hidden />
                <input
                  value={driverName}
                  required
                  disabled={pending}
                  placeholder="James Mwangi"
                  onChange={(e) => {
                    setDriverName(e.target.value);
                    markDirty();
                  }}
                />
              </span>
            </label>
            <label className="ft-truck-field">
              <span className="ft-truck-field__label">
                Driver ID <abbr title="Required">*</abbr>
              </span>
              <span className="ft-truck-field__control">
                <UserRound size={15} aria-hidden />
                <input
                  value={driverId}
                  required
                  disabled={pending}
                  placeholder="DRV-1024"
                  onChange={(e) => {
                    setDriverId(e.target.value);
                    markDirty();
                  }}
                />
              </span>
            </label>
          </div>

          {mode === "edit" ? (
            <label className="ft-truck-field">
              <span className="ft-truck-field__label">Status</span>
              <span className="ft-truck-field__control">
                <BadgeCheck size={15} aria-hidden />
                <select
                  value={status}
                  disabled={pending}
                  onChange={(e) => {
                    setStatus(e.target.value as FleetTruckStatusValue);
                    markDirty();
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </span>
            </label>
          ) : null}

          <section className="ft-comp" aria-labelledby="ft-comp-title">
            <header className="ft-comp__head">
              <span className="ft-comp__ico" aria-hidden>
                <Layers size={16} />
              </span>
              <div>
                <h4 id="ft-comp-title">Compartments</h4>
                <p>Set the number of compartments and their individual capacities. The total must equal the truck capacity.</p>
              </div>
            </header>

            <div className="ft-comp__toolbar">
              <label className="ft-truck-field ft-comp__count">
                <span className="ft-truck-field__label">Number of Compartments</span>
                <span className="ft-truck-field__control">
                  <select
                    value={compartmentCount}
                    disabled={pending}
                    onChange={(e) => setCompartmentCountSafe(Number(e.target.value))}
                  >
                    {Array.from({ length: MAX_COMPARTMENTS - MIN_COMPARTMENTS + 1 }, (_, i) => MIN_COMPARTMENTS + i).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n} Compartment{n === 1 ? "" : "s"}
                        </option>
                      )
                    )}
                  </select>
                </span>
              </label>

              <div
                className={`ft-comp__summary${allocation.valid ? " is-ok" : " is-bad"}`}
                role="status"
                aria-live="polite"
              >
                {allocation.valid ? (
                  <CheckCircle2 size={18} aria-hidden />
                ) : (
                  <Search size={18} aria-hidden />
                )}
                <div className="ft-comp__summary-copy">
                  <strong>{capacityLitres > 0 ? formatCapacityDisplay(capacityLitres) : "—"}</strong>
                  <span>
                    Total Allocated:{" "}
                    <em>
                      {(() => {
                        const allocated = allocation.valid
                          ? capacityLitres
                          : allocation.priorSum + Math.max(0, allocation.lastLitres);
                        return allocated > 0
                          ? `${allocated.toLocaleString("en-US")} L`
                          : "—";
                      })()}
                    </em>
                  </span>
                </div>
                {allocation.valid ? (
                  <span className="ft-comp__badge is-ok">✓ Matches Capacity</span>
                ) : allocation.error ? (
                  <span className="ft-comp__badge is-bad">{allocation.error}</span>
                ) : null}
              </div>
            </div>

            <div className="ft-comp__table-wrap">
              <table className="ft-comp__table">
                <thead>
                  <tr>
                    <th>Compartment</th>
                    <th>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: compartmentCount }, (_, index) => {
                    const isLast = index === compartmentCount - 1;
                    const value = isLast
                      ? allocation.lastLitres > 0
                        ? formatCapacityDisplay(allocation.lastLitres)
                        : ""
                      : (editableCaps[index] ?? "");
                    return (
                      <tr key={index}>
                        <td>
                          <span className="ft-comp__pill">Compartment {index + 1}</span>
                          {isLast ? <span className="ft-comp__auto">Auto</span> : null}
                        </td>
                        <td>
                          <span className={`ft-truck-field__control ft-comp__cap${isLast ? " is-auto" : ""}`}>
                            <Cylinder size={14} aria-hidden />
                            {isLast ? (
                              <input
                                value={value}
                                readOnly
                                tabIndex={-1}
                                aria-label={`Compartment ${index + 1} capacity (calculated)`}
                                placeholder="Calculated"
                              />
                            ) : (
                              <input
                                inputMode="decimal"
                                value={value}
                                disabled={pending}
                                placeholder="2,000 L (2 m³)"
                                aria-label={`Compartment ${index + 1} capacity`}
                                onChange={onGroupedInput(true, (value) => {
                                  const next = [...editableCaps];
                                  next[index] = value;
                                  setEditableCaps(next);
                                  markDirty();
                                })}
                              />
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="ps-modal__actions ft-truck-form__actions">
            <button type="button" className="ps-btn ps-btn--line" onClick={requestClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="ps-btn ps-btn--gold" disabled={pending || !formValid}>
              {pending
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create Truck"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
