/** Digits only, or digits and one decimal point, with thousands separators. */

function groupInteger(intPart: string): string {
  const stripped = intPart.replace(/^0+(?=\d)/, "");
  const body = stripped === "" ? "0" : stripped;
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function sanitizeNumericText(raw: string, decimal: boolean): string {
  const cleaned = decimal ? raw.replace(/[^\d.]/g, "") : raw.replace(/\D/g, "");
  if (!cleaned) return "";
  if (!decimal) return groupInteger(cleaned);
  const dot = cleaned.indexOf(".");
  const intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const frac = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/\./g, "");
  const grouped = groupInteger(intPart === "" ? "0" : intPart);
  if (dot === -1) return grouped;
  return `${grouped}.${frac}`;
}

export function captureGroupedEdit(el: HTMLInputElement, decimal: boolean): { value: string; caret: number } {
  const caret = el.selectionStart ?? el.value.length;
  const value = sanitizeNumericText(el.value, decimal);
  const nextCaret = sanitizeNumericText(el.value.slice(0, caret), decimal).length;
  return { value, caret: nextCaret };
}

export function placeCaret(el: HTMLInputElement, caret: number) {
  requestAnimationFrame(() => {
    if (document.activeElement !== el) return;
    const pos = Math.max(0, Math.min(caret, el.value.length));
    el.setSelectionRange(pos, pos);
  });
}

/** Controlled number field: keep the typed digits and insert thousands separators. */
export function onGroupedInput(decimal: boolean, commit: (value: string) => void) {
  return (event: { currentTarget: HTMLInputElement }) => {
    const { value, caret } = captureGroupedEdit(event.currentTarget, decimal);
    commit(value);
    placeCaret(event.currentTarget, caret);
  };
}

export function applyNumericInput(el: HTMLInputElement, decimal: boolean) {
  const { value, caret } = captureGroupedEdit(el, decimal);
  if (value !== el.value) el.value = value;
  const pos = Math.max(0, Math.min(caret, el.value.length));
  el.setSelectionRange(pos, pos);
  return value;
}

/** For uncontrolled inputs. Strips anything that is not a digit, or a single decimal point. */
export function keepNumeric(decimal: boolean) {
  return (event: { currentTarget: HTMLInputElement }) => {
    applyNumericInput(event.currentTarget, decimal);
  };
}
