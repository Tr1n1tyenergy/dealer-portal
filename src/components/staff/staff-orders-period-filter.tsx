"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Calendar, Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { PeriodKey } from "@/lib/orders/staff-views";

const OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "prev-month", label: "Previous month" },
  { value: "custom", label: "Custom range" },
];

function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatRangeLabel(from: string, to: string): string {
  try {
    return `${format(parseISO(from), "dd MMM yyyy")} – ${format(parseISO(to), "dd MMM yyyy")}`;
  } catch {
    return "Custom range";
  }
}

function labelFor(period: PeriodKey, from: string | null, to: string | null): string {
  if (period === "custom" && from && to) return formatRangeLabel(from, to);
  return OPTIONS.find((o) => o.value === period)?.label ?? "All time";
}

type Props = {
  period: PeriodKey;
  from: string | null;
  to: string | null;
};

export function StaffOrdersPeriodFilter({ period: initialPeriod, from: initialFrom, to: initialTo }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"presets" | "calendar">("presets");
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [pick, setPick] = useState<"start" | "end">(
    initialPeriod === "custom" && initialFrom && !initialTo ? "end" : "start"
  );
  const [month, setMonth] = useState(() => {
    const seed = initialFrom || initialTo;
    return seed ? startOfMonth(parseISO(seed)) : startOfMonth(new Date());
  });

  useEffect(() => {
    setPeriod(initialPeriod);
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialPeriod, initialFrom, initialTo]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPanel("presets");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("presets");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - ((start.getDay() + 6) % 7)); // Monday-first
    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + (6 - ((end.getDay() + 6) % 7)));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const fromDate = from ? parseISO(from) : null;
  const toDate = to ? parseISO(to) : null;
  const triggerLabel = labelFor(period, from, to);

  function openMenu() {
    setOpen((v) => !v);
    setPanel(period === "custom" && from && to ? "calendar" : "presets");
    if (period === "custom" && from) setMonth(startOfMonth(parseISO(from)));
  }

  function choosePreset(value: PeriodKey) {
    if (value === "custom") {
      setPeriod("custom");
      setPick("start");
      setPanel("calendar");
      if (!from && !to) {
        setFrom(null);
        setTo(null);
      }
      return;
    }
    setPeriod(value);
    setFrom(null);
    setTo(null);
    setOpen(false);
    setPanel("presets");
  }

  function onDayClick(day: Date) {
    const iso = toIsoDay(day);
    if (pick === "start" || !fromDate || (fromDate && toDate)) {
      setFrom(iso);
      setTo(null);
      setPick("end");
      setPeriod("custom");
      return;
    }
    if (isBefore(day, fromDate)) {
      setFrom(iso);
      setTo(null);
      setPick("end");
      return;
    }
    setTo(iso);
    setPick("start");
    setPeriod("custom");
  }

  function dayClass(day: Date): string {
    const classes = ["so-period__day"];
    if (!isSameMonth(day, month)) classes.push("is-outside");
    if (fromDate && isSameDay(day, fromDate)) classes.push("is-start");
    if (toDate && isSameDay(day, toDate)) classes.push("is-end");
    if (fromDate && toDate && isAfter(day, fromDate) && isBefore(day, toDate)) classes.push("is-in-range");
    if (isSameDay(day, new Date())) classes.push("is-today");
    return classes.join(" ");
  }

  return (
    <div className="so-field so-field--period" ref={rootRef}>
      <span id={`${listId}-label`}>Reporting Period</span>
      <input type="hidden" name="period" value={period} />
      {period === "custom" && from ? <input type="hidden" name="from" value={from} /> : null}
      {period === "custom" && to ? <input type="hidden" name="to" value={to} /> : null}

      <button
        type="button"
        className="so-period__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        onClick={openMenu}
      >
        <Calendar size={14} strokeWidth={1.75} aria-hidden />
        <span className="so-period__value">{triggerLabel}</span>
        <ChevronsUpDown size={14} strokeWidth={1.75} aria-hidden />
      </button>

      {open ? (
        <div className="so-period__popover" role="presentation">
          {panel === "presets" ? (
            <ul className="so-period__menu" role="listbox" aria-labelledby={`${listId}-label`}>
              {OPTIONS.map((opt) => {
                const selected = period === opt.value && (opt.value !== "custom" || Boolean(from && to));
                const customSelected = opt.value === "custom" && period === "custom";
                const isSelected = opt.value === "custom" ? customSelected : selected;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={`so-period__option${isSelected ? " is-selected" : ""}`}
                      onClick={() => choosePreset(opt.value)}
                    >
                      {isSelected ? <Check size={14} strokeWidth={2.4} aria-hidden /> : <span className="so-period__check-slot" />}
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="so-period__calendar" role="dialog" aria-label="Custom date range">
              <div className="so-period__cal-head">
                <button type="button" className="so-period__nav" onClick={() => setPanel("presets")} aria-label="Back to periods">
                  Periods
                </button>
                <div className="so-period__month">
                  <button
                    type="button"
                    className="so-period__nav-ico"
                    onClick={() => setMonth((m) => subMonths(m, 1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} strokeWidth={2} />
                  </button>
                  <span>{format(month, "MMMM yyyy")}</span>
                  <button
                    type="button"
                    className="so-period__nav-ico"
                    onClick={() => setMonth((m) => addMonths(m, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <p className="so-period__hint">
                {pick === "start" || !from ? "Select start date" : "Select end date"}
              </p>
              <div className="so-period__weekdays" aria-hidden>
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="so-period__grid">
                {days.map((day) => (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={dayClass(day)}
                    onClick={() => onDayClick(day)}
                  >
                    {format(day, "d")}
                  </button>
                ))}
              </div>
              <div className="so-period__legend">
                <span>
                  <i className="so-period__dot so-period__dot--start" /> Start
                </span>
                <span>
                  <i className="so-period__dot so-period__dot--end" /> End
                </span>
              </div>
              {from && to ? (
                <button type="button" className="so-period__done" onClick={() => setOpen(false)}>
                  Done
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
