/**
 * Temporary station forecourt defaults until per-station equipment is configured.
 * Every station: 2 PMS + 2 AGO pumps and tanks.
 * Default tank capacities (config, not operational readings): PMS 100,000 L · AGO 50,000 L.
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

export function resolveStationEquipment(station: {
  pumpCount: number | null;
  tankCount: number | null;
} | null) {
  if (!station) {
    return {
      pumpCount: DEFAULT_STATION_EQUIPMENT.pumpCount,
      tankCount: DEFAULT_STATION_EQUIPMENT.tankCount,
      pumpsByProduct: { ...DEFAULT_STATION_EQUIPMENT.pumpsByProduct },
      tanksByProduct: { ...DEFAULT_STATION_EQUIPMENT.tanksByProduct },
      fromDefault: true,
    };
  }
  const missing = station.pumpCount == null || station.tankCount == null;
  return {
    pumpCount: station.pumpCount ?? DEFAULT_STATION_EQUIPMENT.pumpCount,
    tankCount: station.tankCount ?? DEFAULT_STATION_EQUIPMENT.tankCount,
    pumpsByProduct: { ...DEFAULT_STATION_EQUIPMENT.pumpsByProduct },
    tanksByProduct: { ...DEFAULT_STATION_EQUIPMENT.tanksByProduct },
    fromDefault: missing,
  };
}

export function formatEquipmentBreakdown(count: number, byProduct: { PMS: number; AGO: number }) {
  return `${count} (PMS: ${byProduct.PMS}, AGO: ${byProduct.AGO})`;
}
