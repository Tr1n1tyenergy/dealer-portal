export function formatLitres(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} L`;
}

export function formatProductVolumes(pms: number | null | undefined, ago: number | null | undefined): string {
  const parts: string[] = [];
  if (pms != null) parts.push(`PMS ${pms.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  if (ago != null) parts.push(`AGO ${ago.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function formatKesAmount(value: { toString(): string } | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "—";
  return `KES ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** e.g. `4 Pumps · 2 PMS · 2 AGO` */
export function formatPumpsTanks(params: {
  pumps: number;
  tanksPms: number;
  tanksAgo: number;
}): string {
  const { pumps, tanksPms, tanksAgo } = params;
  return `${pumps} Pump${pumps === 1 ? "" : "s"} · ${tanksPms} PMS · ${tanksAgo} AGO`;
}
