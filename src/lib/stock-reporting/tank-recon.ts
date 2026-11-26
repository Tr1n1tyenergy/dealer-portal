import { centsToLitres, litresToCents } from "./pump-calc";
import { VARIANCE_BALANCE_EPS } from "./wet-calc";

export type TankReconLine = {
  tankKey: string;
  tankLabel: string;
  product: "PMS" | "AGO";
  pumpCount: number;
  meterSales: number;
  tankSales: number;
  variance: number;
};

export type TankReconInput = {
  tanks: { tankKey: string; label: string; product: string }[];
  /** Configured pumps, one row each. Repeated days must not be passed here. */
  pumps: { tankKey: string }[];
  /** Meter sales already attributed to a tank. May repeat across days. */
  meterSales: { tankKey: string; sales: number | null }[];
  tankSales: { tankKey: string; sales: number | null }[];
};

/** Sum the pumps on each physical tank and compare that total with the tank's own dip. */
export function reconcilePumpsToTanks(input: TankReconInput): TankReconLine[] {
  return input.tanks
    .filter((tank) => tank.product === "PMS" || tank.product === "AGO")
    .map((tank) => {
      const product = tank.product === "AGO" ? "AGO" : "PMS";
      const pumpCount = input.pumps.filter((pump) => pump.tankKey === tank.tankKey).length;
      let meterC = 0;
      for (const sale of input.meterSales) {
        if (sale.tankKey !== tank.tankKey || sale.sales == null) continue;
        meterC += litresToCents(sale.sales);
      }
      let tankC = 0;
      for (const reading of input.tankSales) {
        if (reading.tankKey !== tank.tankKey || reading.sales == null) continue;
        tankC += litresToCents(reading.sales);
      }
      return {
        tankKey: tank.tankKey,
        tankLabel: tank.label,
        product,
        pumpCount,
        meterSales: centsToLitres(meterC),
        tankSales: centsToLitres(tankC),
        variance: centsToLitres(meterC - tankC),
      };
    });
}

export function tankLinesBalanced(lines: TankReconLine[]): boolean {
  const limit = litresToCents(VARIANCE_BALANCE_EPS);
  return lines.every((line) => Math.abs(litresToCents(line.variance)) <= limit);
}

export function rollupTankLines(lines: TankReconLine[]) {
  let meterPms = 0;
  let meterAgo = 0;
  let tankPms = 0;
  let tankAgo = 0;
  for (const line of lines) {
    if (line.product === "PMS") {
      meterPms += litresToCents(line.meterSales);
      tankPms += litresToCents(line.tankSales);
    } else {
      meterAgo += litresToCents(line.meterSales);
      tankAgo += litresToCents(line.tankSales);
    }
  }
  return {
    meterPms: centsToLitres(meterPms),
    meterAgo: centsToLitres(meterAgo),
    tankPms: centsToLitres(tankPms),
    tankAgo: centsToLitres(tankAgo),
  };
}
