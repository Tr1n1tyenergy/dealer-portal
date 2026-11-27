"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck, Trash2, X, Layers } from "lucide-react";
import "./order-transport.css";
import {
  capacityNotice,
  driverRecordLabel,
  sortDriverRecords,
  transportCapacity,
  transportDash,
  type OrderDriverRecord,
  type TransportLine,
} from "@/lib/orders/transport";

export function TransportTable({
  lines,
  onRemove,
}: {
  lines: TransportLine[];
  onRemove?: (id: number) => void;
}) {
  return (
    <div className="po-tx__scroll">
      <table className="po-tx__table">
        <thead>
          <tr>
            <th>Driver (ID)</th>
            <th>Driver EPRA</th>
            <th>Truck plate</th>
            <th>Truck EPRA</th>
            <th>Capacity (L)</th>
            <th>Contact</th>
            {onRemove ? <th className="po-tx__actions">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <span className="po-tx__driver">
                  <Truck size={15} strokeWidth={2.1} aria-hidden />
                  {driverRecordLabel(line)}
                </span>
              </td>
              <td>{transportDash(line.driverEpra)}</td>
              <td>{transportDash(line.truckPlate)}</td>
              <td>{transportDash(line.truckEpra)}</td>
              <td className="po-tx__num">{transportCapacity(line.capacityLitres)}</td>
              <td>{transportDash(line.contactName)}</td>
              {onRemove ? (
                <td className="po-tx__actions">
                  <button
                    type="button"
                    className="po-tx__remove"
                    aria-label={`Remove ${driverRecordLabel(line)}`}
                    onClick={() => onRemove(line.id)}
                  >
                    <Trash2 size={14} strokeWidth={2.1} aria-hidden />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderTransportPanel({ lines }: { lines: TransportLine[] }) {
  if (lines.length === 0) {
    return <p className="po-tx__missing">No driver record was attached to this order.</p>;
  }
  return <TransportTable lines={lines} />;
}

function recordHaystack(record: OrderDriverRecord) {
  return [record.driverName, record.driverNo, record.truckPlate, record.driverEpra, record.truckEpra, record.contactName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function PlaceOrderTransport({
  drivers,
  driversError,
  selected,
  onChange,
  orderLitres,
}: {
  drivers: OrderDriverRecord[];
  driversError: string | null;
  selected: OrderDriverRecord[];
  onChange: (ids: number[]) => void;
  orderLitres: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const notice = capacityNotice(selected, orderLitres);
  const selectedIds = useMemo(() => new Set(selected.map((record) => record.id)), [selected]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openPicker() {
    setQuery("");
    setPicked([]);
    setOpen(true);
  }

  const needle = query.trim().toLowerCase();
  const matches = (record: OrderDriverRecord) => !needle || recordHaystack(record).includes(needle);
  const choices = sortDriverRecords(drivers.filter((record) => !selectedIds.has(record.id) && matches(record)));
  const already = sortDriverRecords(drivers.filter((record) => selectedIds.has(record.id) && matches(record)));

  function confirm() {
    if (picked.length === 0) return;
    onChange([...selected.map((record) => record.id), ...picked]);
    setOpen(false);
  }

  return (
    <section className="po__card" id="order-transport">
      <div className="po-tx__head">
        <div className="po-tx__lead">
          <span className="po__card-ico" aria-hidden>
            <Truck size={18} strokeWidth={2.1} />
          </span>
          <div className="po-tx__titles">
            <div className="po-tx__title-row">
              <h2>Transportation</h2>
              <span className="po-tx__badge">Required</span>
            </div>
            <p>Select one or more driver records (each includes driver, truck and capacity) to transport this order.</p>
          </div>
        </div>
      </div>

      {driversError ? <p className="po__error">{driversError}</p> : null}

      {selected.length > 0 ? (
        <>
          <div className="po-tx__add-row">
            <button type="button" className="po-tx__add" onClick={openPicker} disabled={Boolean(driversError) || drivers.length === 0}>
              <Plus size={14} strokeWidth={2.4} aria-hidden />
              Add Driver Record
            </button>
          </div>
          <TransportTable lines={selected} onRemove={(id) => onChange(selected.filter((record) => record.id !== id).map((record) => record.id))} />
        </>
      ) : (
        <div className="po-tx__empty">
          <span className="po-tx__empty-ico" aria-hidden>
            <Truck size={16} strokeWidth={2.1} />
          </span>
          <div>
            <strong>No transportation added</strong>
            <p>Select at least one driver record to continue with your fuel order.</p>
          </div>
          <button type="button" className="po-tx__add" onClick={openPicker} disabled={Boolean(driversError) || drivers.length === 0}>
            <Plus size={14} strokeWidth={2.4} aria-hidden />
            Add Driver Record
          </button>
        </div>
      )}

      {notice ? <p className="po-tx__note">{notice}</p> : null}
      {!driversError && drivers.length === 0 ? <p className="po-tx__note">No driver records are available to choose from.</p> : null}

      <div className="po__total-bar">
        <div className="po__total-bar-left">
          <Layers size={18} color="#3551A5" aria-hidden />
          <span>Total Order Volume</span>
        </div>
        <strong>{orderLitres.toLocaleString("en-US")} L</strong>
      </div>

      {open ? (
        <div className="po-tx__modal" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="po-tx__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="select-driver-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="po-tx__dialog-head">
              <span className="po__card-ico" aria-hidden>
                <Truck size={18} strokeWidth={2.1} />
              </span>
              <div>
                <h2 id="select-driver-title">Select Driver Record</h2>
                <p>Choose an existing driver and truck for this fuel order.</p>
              </div>
              <button type="button" className="po-tx__close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <label className="po-tx__search">
              <Search size={16} aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, driver ID, plate, EPRA or contact"
                aria-label="Search driver records"
                autoFocus
              />
            </label>
            <div className="po-tx__list">
              {choices.length === 0 && already.length === 0 ? <p className="po-tx__none">No driver records match that search.</p> : null}
              {choices.map((record) => {
                const on = picked.includes(record.id);
                return (
                  <button
                    key={record.id}
                    type="button"
                    className={`po-tx__option${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    onClick={() => setPicked((current) => (current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id]))}
                  >
                    <span className={`po-tx__check${on ? " is-on" : ""}`} aria-hidden />
                    <span>
                      <strong>{driverRecordLabel(record)}</strong>
                      <span>
                        {transportDash(record.truckPlate)} · {transportCapacity(record.capacityLitres)} L · {transportDash(record.contactName)}
                      </span>
                    </span>
                  </button>
                );
              })}
              {already.map((record) => (
                <div key={record.id} className="po-tx__option is-added">
                  <span />
                  <span>
                    <strong>{driverRecordLabel(record)}</strong>
                    <span>{transportDash(record.truckPlate)}</span>
                  </span>
                  <em className="po-tx__added">Added</em>
                </div>
              ))}
            </div>
            <div className="po-tx__dialog-actions">
              <button type="button" className="po-tx__cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="po-tx__confirm" disabled={picked.length === 0} onClick={confirm}>
                {picked.length === 0 ? "Add driver records" : `Add ${picked.length} driver record${picked.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
