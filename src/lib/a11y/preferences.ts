/**
 * Accessibility choices saved per device (localStorage) and applied as data-a11y-* attributes on <html>.
 * Client- and server-safe: no DOM access at import time.
 */

export type A11yText = "normal" | "large" | "xlarge";
export type A11yPrefs = { text: A11yText; contrast: boolean; motion: boolean };

export const A11Y_STORAGE_KEY = "tri-a11y";
export const A11Y_DEFAULTS: A11yPrefs = { text: "normal", contrast: false, motion: false };

const ATTRS = ["data-a11y-text", "data-a11y-contrast", "data-a11y-motion", "data-a11y-font"] as const;

/** Stored JSON → prefs; anything unknown falls back to the default for that field. */
export function parsePrefs(raw: string | null | undefined): A11yPrefs {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "");
  } catch {
    return { ...A11Y_DEFAULTS };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...A11Y_DEFAULTS };
  const v = value as Record<string, unknown>;
  return {
    text: v.text === "large" || v.text === "xlarge" ? v.text : "normal",
    contrast: v.contrast === true,
    motion: v.motion === true,
  };
}

/** Only the non-default attributes, e.g. { "data-a11y-text": "large" }. */
export function prefsAttributes(p: A11yPrefs): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.text !== "normal") out["data-a11y-text"] = p.text;
  if (p.contrast) out["data-a11y-contrast"] = "";
  if (p.motion) out["data-a11y-motion"] = "reduce";
  return out;
}

type AttrTarget = { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };

export function applyPrefs(root: AttrTarget, p: A11yPrefs): void {
  const attrs = prefsAttributes(p);
  for (const name of ATTRS) {
    // Always clear legacy data-a11y-font (Readable font option removed).
    if (name in attrs) root.setAttribute(name, attrs[name]);
    else root.removeAttribute(name);
  }
}

export function readPrefs(storage?: Pick<Storage, "getItem">): A11yPrefs {
  try {
    return parsePrefs((storage ?? window.localStorage).getItem(A11Y_STORAGE_KEY));
  } catch {
    return { ...A11Y_DEFAULTS };
  }
}

export function writePrefs(p: A11yPrefs, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? window.localStorage).setItem(A11Y_STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Private windows can refuse storage; the choice still applies for this page view.
  }
}

/** Runs in <head> before first paint; mirrors parsePrefs + applyPrefs (it cannot import them). */
export const A11Y_HEAD_SCRIPT = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  A11Y_STORAGE_KEY,
)})||"{}"),r=document.documentElement;r.removeAttribute("data-a11y-font");if(p&&typeof p==="object"){if(p.text==="large"||p.text==="xlarge")r.setAttribute("data-a11y-text",p.text);else r.removeAttribute("data-a11y-text");if(p.contrast===true)r.setAttribute("data-a11y-contrast","");else r.removeAttribute("data-a11y-contrast");if(p.motion===true)r.setAttribute("data-a11y-motion","reduce");else r.removeAttribute("data-a11y-motion")}}catch(e){}`;
