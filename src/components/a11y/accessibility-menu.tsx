"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PersonStanding, X } from "lucide-react";
import {
  A11Y_DEFAULTS,
  applyPrefs,
  readPrefs,
  writePrefs,
  type A11yPrefs,
  type A11yText,
} from "@/lib/a11y/preferences";
import "./accessibility-menu.css";

const TEXT_SIZES: { value: A11yText; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

const SWITCHES: { key: "contrast" | "motion" | "font"; label: string; hint: string }[] = [
  { key: "contrast", label: "High contrast", hint: "Darker text and a strong focus outline" },
  { key: "motion", label: "Reduce motion", hint: "No slides, fades or zoom" },
  { key: "font", label: "Readable font", hint: "Plainer, wider letters" },
];

/** Accessibility settings for this device: a header button (dealer/staff) or a floating one (everywhere else). */
export function AccessibilityMenu({ variant }: { variant: "header" | "floating" }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(A11Y_DEFAULTS);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const textGroupId = useId();

  useEffect(() => {
    if (!open) return;
    setPrefs(readPrefs());
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const update = (next: A11yPrefs) => {
    setPrefs(next);
    applyPrefs(document.documentElement, next);
    writePrefs(next);
  };

  return (
    <div ref={wrapRef} className={`a11y-menu a11y-menu--${variant}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`a11y-trigger a11y-trigger--${variant}`}
        aria-label="Accessibility"
        title="Accessibility"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <PersonStanding size={variant === "header" ? 18 : 22} strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label="Accessibility settings" className="a11y-panel">
          <div className="a11y-panel__head">
            <h2 className="a11y-panel__title">Accessibility</h2>
            <button
              type="button"
              className="a11y-panel__close"
              aria-label="Close accessibility settings"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <p className="a11y-panel__note">Saved on this device only.</p>

          <div className="a11y-field">
            <span id={textGroupId} className="a11y-field__label">
              Text size
            </span>
            <div role="radiogroup" aria-labelledby={textGroupId} className="a11y-sizes">
              {TEXT_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={prefs.text === s.value}
                  className={`a11y-size a11y-size--${s.value}`}
                  onClick={() => update({ ...prefs, text: s.value })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {SWITCHES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="switch"
              aria-checked={prefs[s.key]}
              className="a11y-switch"
              onClick={() => update({ ...prefs, [s.key]: !prefs[s.key] })}
            >
              <span className="a11y-switch__text">
                <span className="a11y-switch__label">{s.label}</span>
                <span className="a11y-switch__hint">{s.hint}</span>
              </span>
              <span className="a11y-switch__track" aria-hidden>
                <span className="a11y-switch__thumb" />
              </span>
            </button>
          ))}

          <button type="button" className="a11y-reset" onClick={() => update({ ...A11Y_DEFAULTS })}>
            Reset to default
          </button>
        </div>
      ) : null}
    </div>
  );
}
