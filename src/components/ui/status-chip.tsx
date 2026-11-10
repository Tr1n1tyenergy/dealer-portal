import type { DealerOrderStatus } from "@prisma/client";
import { statusTone } from "@/lib/ui/status-tone";

/** One colour per meaning across all portals (redesign spec §3). */
export function StatusChip({ status, label }: { status: DealerOrderStatus; label: string }) {
  return <span className={`ui-chip ui-chip--${statusTone(status)}`}>{label}</span>;
}
