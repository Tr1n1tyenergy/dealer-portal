/** Fleet truck compartment allocation helpers (litres canonical). */

export const MIN_COMPARTMENTS = 1;
export const MAX_COMPARTMENTS = 8;

/** Milli-litres for exact sum checks (3 dp). */
export function litresToMilli(n: number): number {
  return Math.round(n * 1000);
}

export function milliToLitres(m: number): number {
  return m / 1000;
}

export function formatCapacityDisplay(litres: number): string {
  if (!Number.isFinite(litres)) return "—";
  const rounded = Math.round(litres * 1000) / 1000;
  const m3 = rounded / 1000;
  const m3Label = Number.isInteger(m3)
    ? String(m3)
    : (Math.round(m3 * 1000) / 1000).toString();
  return `${rounded.toLocaleString("en-US")} L (${m3Label} m³)`;
}

export function parseLitresInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

/**
 * Build full compartment capacities: first (n−1) from editable inputs, last = remainder.
 * Returns null last when remainder is invalid (≤0 or exceeds total when prior sum > total).
 */
export function resolveCompartmentCapacities(
  totalLitres: number,
  compartmentCount: number,
  editableLitres: Array<number | null>
): { capacities: number[]; lastLitres: number; priorSum: number; valid: boolean; error: string | null } {
  const n = Math.min(MAX_COMPARTMENTS, Math.max(MIN_COMPARTMENTS, Math.floor(compartmentCount)));
  if (!Number.isFinite(totalLitres) || totalLitres <= 0) {
    return {
      capacities: Array.from({ length: n }, () => 0),
      lastLitres: 0,
      priorSum: 0,
      valid: false,
      error: "Enter a valid truck capacity.",
    };
  }

  if (n === 1) {
    return {
      capacities: [totalLitres],
      lastLitres: totalLitres,
      priorSum: 0,
      valid: true,
      error: null,
    };
  }

  const editableCount = n - 1;
  const priors: number[] = [];
  for (let i = 0; i < editableCount; i += 1) {
    const v = editableLitres[i];
    if (v == null || !Number.isFinite(v)) {
      return {
        capacities: Array.from({ length: n }, (_, idx) => (idx < editableCount ? editableLitres[idx] ?? 0 : 0)),
        lastLitres: 0,
        priorSum: priors.reduce((a, b) => a + b, 0),
        valid: false,
        error: `Enter a capacity for Compartment ${i + 1}.`,
      };
    }
    if (v <= 0) {
      return {
        capacities: Array.from({ length: n }, () => 0),
        lastLitres: 0,
        priorSum: 0,
        valid: false,
        error: `Compartment ${i + 1} must be greater than zero.`,
      };
    }
    priors.push(v);
  }

  const priorMilli = priors.reduce((a, b) => a + litresToMilli(b), 0);
  const totalMilli = litresToMilli(totalLitres);
  const lastMilli = totalMilli - priorMilli;
  const lastLitres = milliToLitres(lastMilli);
  const capacities = [...priors, lastLitres];

  if (lastMilli <= 0) {
    return {
      capacities,
      lastLitres,
      priorSum: milliToLitres(priorMilli),
      valid: false,
      error:
        lastMilli === 0
          ? "Final compartment would be zero. Reduce earlier compartment capacities."
          : `Allocated capacity exceeds truck capacity by ${milliToLitres(-lastMilli).toLocaleString("en-KE")} L.`,
    };
  }

  return {
    capacities,
    lastLitres,
    priorSum: milliToLitres(priorMilli),
    valid: true,
    error: null,
  };
}
