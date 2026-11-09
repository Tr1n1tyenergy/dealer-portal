import { centsToLitres, litresToCents } from "./pump-calc";

/** Treat sub-centilitre noise as balanced. */
export const VARIANCE_BALANCE_EPS = 0.005;

export type WetProductTotals = {
  meterPms: number;
  meterAgo: number;
  tankPms: number;
  tankAgo: number;
};

export type WetVarianceSummary = WetProductTotals & {
  meterTotal: number;
  tankTotal: number;
  variancePms: number;
  varianceAgo: number;
  /** Net signed variance (Meter − Tank). */
  varianceTotal: number;
  absoluteVariance: number;
  balanced: boolean;
};

/** Variance = Meter Sales − Adjusted Tank Stock Movement (per product). */
export function computeWetVariances(input: WetProductTotals): WetVarianceSummary {
  const meterPmsC = litresToCents(input.meterPms);
  const meterAgoC = litresToCents(input.meterAgo);
  const tankPmsC = litresToCents(input.tankPms);
  const tankAgoC = litresToCents(input.tankAgo);

  const variancePmsC = meterPmsC - tankPmsC;
  const varianceAgoC = meterAgoC - tankAgoC;
  const varianceTotalC = variancePmsC + varianceAgoC;
  const absoluteC = Math.abs(variancePmsC) + Math.abs(varianceAgoC);

  return {
    meterPms: centsToLitres(meterPmsC),
    meterAgo: centsToLitres(meterAgoC),
    tankPms: centsToLitres(tankPmsC),
    tankAgo: centsToLitres(tankAgoC),
    meterTotal: centsToLitres(meterPmsC + meterAgoC),
    tankTotal: centsToLitres(tankPmsC + tankAgoC),
    variancePms: centsToLitres(variancePmsC),
    varianceAgo: centsToLitres(varianceAgoC),
    varianceTotal: centsToLitres(varianceTotalC),
    absoluteVariance: centsToLitres(absoluteC),
    balanced: absoluteC <= litresToCents(VARIANCE_BALANCE_EPS),
  };
}

export function formatVarianceLitres(value: number): string {
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > VARIANCE_BALANCE_EPS) return abs;
  if (value < -VARIANCE_BALANCE_EPS) return `−${abs}`;
  return abs;
}
