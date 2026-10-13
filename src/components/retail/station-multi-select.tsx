"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export type StationChoice = {
  stationCode: string;
  stationName: string;
  invitable: boolean;
  hasLogin: boolean;
  loginEmail?: string | null;
};

/** Checkbox dropdown for the dealer invite. Rules are checked by the caller, not here. */
export function StationMultiSelect({
  id,
  stations,
  value,
  onChange,
}: {
  id: string;
  stations: StationChoice[];
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const names = stations.filter((s) => value.includes(s.stationCode)).map((s) => s.stationName);

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  }

  return (
    <div
      className="ru-multi"
      ref={root}
      onBlur={(e) => {
        // Tabbing on to the next field closes the list so it doesn't cover it.
        if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="ru-field__control">
        <MapPin size={15} strokeWidth={1.75} />
        <button
          id={id}
          ref={trigger}
          type="button"
          className="ru-multi__trigger"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => setOpen((o) => !o)}
        >
          {names.length ? names.join(", ") : "Select stations…"}
        </button>
      </div>
      {open ? (
        <div id={`${id}-list`} className="ru-multi__list" role="group" aria-label="Stations" tabIndex={-1}>
          {stations.map((s) => {
            const reason = s.hasLogin
              ? `has login${s.loginEmail ? ` (${s.loginEmail})` : ""}`
              : !s.invitable
                ? "missing Odoo IDs"
                : "";
            return (
              <label key={s.stationCode} className={reason ? "ru-multi__option is-disabled" : "ru-multi__option"}>
                <input
                  type="checkbox"
                  checked={value.includes(s.stationCode)}
                  disabled={Boolean(reason)}
                  onChange={() => toggle(s.stationCode)}
                />
                <span>{s.stationName}</span>
                {reason ? <em>{reason}</em> : null}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
