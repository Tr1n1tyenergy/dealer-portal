"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, MapPin, Search } from "lucide-react";

export type StationChoice = {
  stationCode: string;
  stationName: string;
  invitable: boolean;
  hasLogin: boolean;
  loginEmail?: string | null;
};

const PANEL_MIN_WIDTH = 320;

/** Searchable multi-select for dealer invite stations (mockup: Premium Invite Dealer Station Selector). */
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
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function placePanel() {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(PANEL_MIN_WIDTH, r.width * 1.65);
    const left = Math.min(r.left, window.innerWidth - width - 12);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const maxList = Math.min(240, Math.max(140, spaceBelow - 110));
    setPanelStyle({
      position: "fixed",
      top: r.bottom + 6,
      left: Math.max(12, left),
      width,
      zIndex: 9999,
      ["--ru-multi-list-max" as string]: `${maxList}px`,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    const onScroll = () => placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.clearTimeout(t);
    };
  }, [open]);

  const selected = useMemo(
    () => stations.filter((s) => value.includes(s.stationCode)),
    [stations, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      const hay = `${s.stationName} ${s.loginEmail ?? ""} ${s.stationCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [stations, query]);

  const label =
    selected.length === 0
      ? "Select station(s)..."
      : selected.length === 1
        ? selected[0].stationName
        : `${selected.length} stations selected`;

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  }

  const panel =
    open && typeof document !== "undefined" ? (
      createPortal(
        <div
          ref={panelRef}
          className="ru-multi__panel"
          id={`${id}-list`}
          role="listbox"
          aria-multiselectable="true"
          tabIndex={-1}
          style={panelStyle}
        >
          <label className="ru-multi__search">
            <Search size={15} strokeWidth={1.75} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stations..."
              aria-label="Search stations"
            />
          </label>
          <div className="ru-multi__list">
            {filtered.length === 0 ? (
              <div className="ru-multi__empty">No stations match.</div>
            ) : (
              filtered.map((s) => {
                const checked = value.includes(s.stationCode);
                const reason = s.hasLogin
                  ? `has login${s.loginEmail ? ` (${s.loginEmail})` : ""}`
                  : !s.invitable
                    ? "Missing Odoo IDs"
                    : "";
                const disabled = Boolean(reason) && !checked;
                return (
                  <button
                    key={s.stationCode}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    disabled={disabled}
                    className={`ru-multi__option ${checked ? "is-selected" : ""} ${reason ? "has-note" : ""}`}
                    onClick={() => {
                      if (disabled) return;
                      toggle(s.stationCode);
                    }}
                  >
                    <span className={`ru-multi__check ${checked ? "is-on" : ""}`} aria-hidden>
                      {checked ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="ru-multi__name">
                      <span>{s.stationName}</span>
                      {reason ? <em>{reason}</em> : null}
                    </span>
                    <span className="ru-multi__pin" aria-hidden>
                      <MapPin size={12} strokeWidth={2} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="ru-multi__foot">
            <strong>
              {value.length} station{value.length === 1 ? "" : "s"} selected
            </strong>
            <button
              type="button"
              className="ru-multi__clear"
              disabled={value.length === 0}
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          </div>
        </div>,
        document.body,
      )
    ) : null;

  return (
    <div className={`ru-multi ${open ? "is-open" : ""}`} ref={root}>
      <div className={`ru-field__control ${open ? "is-focus" : ""}`}>
        <MapPin size={14} strokeWidth={1.75} aria-hidden />
        <button
          id={id}
          ref={trigger}
          type="button"
          className="ru-multi__trigger"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={selected.length ? "ru-multi__value" : "ru-multi__placeholder"}>{label}</span>
        </button>
        <span className="ru-multi__chev" aria-hidden />
      </div>
      {panel}
    </div>
  );
}
