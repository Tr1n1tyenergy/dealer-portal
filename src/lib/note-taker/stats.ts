import { nairobiMonthStart } from "@/lib/time/nairobi";

type SessionLike = {
  status: string;
  startedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
  notesStatus: string;
};

/** % change, or null when last month had nothing (a "+100%" from zero says nothing). */
const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** The Note Taker's three headline figures for this Nairobi month, from the real sessions only. */
export function noteTakerStats(sessions: SessionLike[], at: Date = new Date()) {
  const start = nairobiMonthStart(at).getTime();
  const prevStart = nairobiMonthStart(at, -1).getTime();
  const month = (from: number, to: number) => {
    const inMonth = sessions.filter((s) => {
      const t = new Date(s.startedAt ?? s.createdAt).getTime();
      return t >= from && t < to;
    });
    const recorded = inMonth.filter((s) => s.status === "COMPLETED" || s.durationSeconds);
    return {
      meetings: recorded.length,
      hours: Math.round((recorded.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 3600) * 10) / 10,
      notes: inMonth.filter((s) => s.notesStatus === "READY").length,
    };
  };
  const now = month(start, Infinity);
  const before = month(prevStart, start);
  return {
    ...now,
    trend: { meetings: change(now.meetings, before.meetings), hours: change(now.hours, before.hours), notes: change(now.notes, before.notes) },
  };
}
