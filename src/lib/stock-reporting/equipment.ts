import { prisma } from "@/lib/prisma";

/**
 * Legacy display/seed defaults for pumps (and label fallbacks only).
 * Tanks are configured exclusively in Platform Settings → Tank Management (`StationTank`).
 * Do not auto-create tanks from these defaults.
 */
export const DEFAULT_STATION_EQUIPMENT = {
  pumpCount: 4,
  tankCount: 4,
  pumpsByProduct: {
    PMS: 2,
    AGO: 2,
  },
  tanksByProduct: {
    PMS: 2,
    AGO: 2,
  },
  tankCapacityLitres: {
    PMS: 100_000,
    AGO: 50_000,
  },
} as const;

export type FuelProductCode = "PMS" | "AGO";

export type StationPumpDefinition = {
  pumpKey: string;
  product: FuelProductCode;
  label: string;
  sortOrder: number;
};

export type StationTankDefinition = {
  tankKey: string;
  product: FuelProductCode;
  label: string;
  sortOrder: number;
  capacityLitres: number;
};

/** Stable default pump list: PMS 1–2, AGO 1–2. */
export function defaultPumpDefinitions(): StationPumpDefinition[] {
  const defs: StationPumpDefinition[] = [];
  let sort = 0;
  for (const product of ["PMS", "AGO"] as const) {
    const count = DEFAULT_STATION_EQUIPMENT.pumpsByProduct[product];
    for (let i = 1; i <= count; i += 1) {
      defs.push({
        pumpKey: `${product}-${i}`,
        product,
        label: `${product} ${i}`,
        sortOrder: sort,
      });
      sort += 1;
    }
  }
  return defs;
}

/** Stable default tank list: PMS Tank 1–2, AGO Tank 1–2. */
export function defaultTankDefinitions(): StationTankDefinition[] {
  const defs: StationTankDefinition[] = [];
  let sort = 0;
  for (const product of ["PMS", "AGO"] as const) {
    const count = DEFAULT_STATION_EQUIPMENT.tanksByProduct[product];
    for (let i = 1; i <= count; i += 1) {
      defs.push({
        tankKey: `${product}-${i}`,
        product,
        label: `${product} Tank ${i}`,
        sortOrder: sort,
        capacityLitres: DEFAULT_STATION_EQUIPMENT.tankCapacityLitres[product],
      });
      sort += 1;
    }
  }
  return defs;
}

export function resolveStationEquipment(
  station: {
    pumpCount: number | null;
    tankCount: number | null;
  } | null,
  overrides?: {
    tankCount?: number;
    tanksByProduct?: { PMS: number; AGO: number };
    pumpCount?: number;
    pumpsByProduct?: { PMS: number; AGO: number };
  }
) {
  if (!station) {
    return {
      pumpCount: overrides?.pumpCount ?? DEFAULT_STATION_EQUIPMENT.pumpCount,
      tankCount: overrides?.tankCount ?? DEFAULT_STATION_EQUIPMENT.tankCount,
      pumpsByProduct: overrides?.pumpsByProduct ?? { ...DEFAULT_STATION_EQUIPMENT.pumpsByProduct },
      tanksByProduct: overrides?.tanksByProduct ?? { ...DEFAULT_STATION_EQUIPMENT.tanksByProduct },
      fromDefault: true,
    };
  }
  const missingPumps = station.pumpCount == null && overrides?.pumpCount == null;
  const tankCount = overrides?.tankCount ?? station.tankCount ?? 0;
  return {
    pumpCount: overrides?.pumpCount ?? station.pumpCount ?? DEFAULT_STATION_EQUIPMENT.pumpCount,
    tankCount,
    pumpsByProduct: overrides?.pumpsByProduct ?? { ...DEFAULT_STATION_EQUIPMENT.pumpsByProduct },
    tanksByProduct: overrides?.tanksByProduct ?? { PMS: 0, AGO: 0 },
    fromDefault: missingPumps && overrides?.tankCount == null,
  };
}

/** Active tanks, and the pumps actually linked to them. */
export async function loadLinkedEquipment(stationId: string): Promise<{
  tankCount: number;
  tanksByProduct: { PMS: number; AGO: number };
  pumpCount: number;
  pumpsByProduct: { PMS: number; AGO: number };
}> {
  const tanks = await prisma.stationTank.findMany({
    where: { stationId, active: true },
    select: { product: true },
  });
  const pumps = await prisma.stationPump.findMany({
    where:
      tanks.length > 0
        ? { stationId, active: true, tankId: { not: null }, tank: { active: true } }
        : { stationId, active: true },
    select: { product: true },
  });
  const tanksByProduct = { PMS: 0, AGO: 0 };
  const pumpsByProduct = { PMS: 0, AGO: 0 };
  for (const tank of tanks) {
    if (tank.product === "PMS" || tank.product === "AGO") tanksByProduct[tank.product] += 1;
  }
  for (const pump of pumps) {
    if (pump.product === "PMS" || pump.product === "AGO") pumpsByProduct[pump.product] += 1;
  }
  return {
    tankCount: tanks.length,
    tanksByProduct,
    pumpCount: pumps.length,
    pumpsByProduct,
  };
}

/** Active tank counts from Platform Settings (`StationTank`). */
export async function loadActiveTankEquipment(stationId: string): Promise<{
  tankCount: number;
  tanksByProduct: { PMS: number; AGO: number };
}> {
  const tanks = await prisma.stationTank.findMany({
    where: { stationId, active: true },
    select: { product: true },
  });
  const tanksByProduct = { PMS: 0, AGO: 0 };
  for (const t of tanks) {
    if (t.product === "PMS") tanksByProduct.PMS += 1;
    else if (t.product === "AGO") tanksByProduct.AGO += 1;
  }
  return { tankCount: tanks.length, tanksByProduct };
}

export function formatEquipmentBreakdown(count: number, byProduct: { PMS: number; AGO: number }) {
  return `${count} (PMS: ${byProduct.PMS}, AGO: ${byProduct.AGO})`;
}
