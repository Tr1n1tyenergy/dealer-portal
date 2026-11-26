export const MAX_PUMPS_PER_TANK = 30;

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

export function parsePumpCount(raw: string): { ok: true; count: number } | { ok: false; error: string } {
  const text = raw.replace(/,/g, "").trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: "Number of pumps must be a whole number." };
  }
  const count = Number(text);
  if (count < 1) return { ok: false, error: "A tank needs at least one pump." };
  if (count > MAX_PUMPS_PER_TANK) {
    return { ok: false, error: `A tank can have at most ${MAX_PUMPS_PER_TANK} pumps.` };
  }
  return { ok: true, count };
}

export function pumpIndexFromKey(pumpKey: string): number | null {
  const tagged = pumpKey.match(/-P(\d+)$/i);
  if (tagged) return Number(tagged[1]);
  const legacy = pumpKey.match(/^[A-Za-z]+-(\d+)$/);
  return legacy ? Number(legacy[1]) : null;
}

export function pumpKeyForTank(tankKey: string, index: number) {
  return `${tankKey}-P${index}`;
}

export function pumpLabelForIndex(index: number) {
  return `Pump ${index}`;
}

export type PumpSlot = {
  id: string;
  pumpKey: string;
  label: string;
  active: boolean;
  index: number;
};

export function slotsFromPumps(pumps: { id: string; pumpKey: string; label: string; active: boolean }[]): PumpSlot[] {
  return pumps.map((pump, order) => ({
    ...pump,
    index: pumpIndexFromKey(pump.pumpKey) ?? order + 1,
  }));
}

/** Which existing pumps to wake or retire, and which new indexes to create. Never deletes a pump. */
export function planPumpAdjustment(pumps: PumpSlot[], desired: number) {
  const active = pumps.filter((pump) => pump.active).sort((a, b) => a.index - b.index);
  const inactive = pumps.filter((pump) => !pump.active).sort((a, b) => a.index - b.index);
  if (desired === active.length) {
    return { reactivateIds: [] as string[], createIndexes: [] as number[], deactivate: [] as PumpSlot[] };
  }
  if (desired > active.length) {
    const need = desired - active.length;
    const reactivate = inactive.slice(0, need);
    const still = need - reactivate.length;
    const used = new Set(pumps.map((pump) => pump.index));
    const createIndexes: number[] = [];
    let n = 1;
    while (createIndexes.length < still) {
      if (!used.has(n)) {
        createIndexes.push(n);
        used.add(n);
      }
      n += 1;
    }
    return { reactivateIds: reactivate.map((pump) => pump.id), createIndexes, deactivate: [] as PumpSlot[] };
  }
  const drop = active.length - desired;
  const deactivate = [...active].sort((a, b) => b.index - a.index).slice(0, drop);
  return { reactivateIds: [] as string[], createIndexes: [] as number[], deactivate };
}

export function pumpCountSentence(count: number) {
  const word = COUNT_WORDS[count] ?? String(count);
  const noun = count === 1 ? "pump" : "pumps";
  return `${word} ${noun} will be automatically created and linked to this tank.`;
}
