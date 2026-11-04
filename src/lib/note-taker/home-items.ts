import { createHash } from "node:crypto";
import { NAIROBI_OFFSET_MS } from "@/lib/time/nairobi";

/** A Note Taker session as the Home reads it; `at` is when it happened or is scheduled. */
export type HomeSession = { id: string; name: string; at: Date; notesJson: string | null };
const DAY = 86400e3;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The key a ticked item is saved under: sha1 of the trimmed lower-case text, so re-generated notes keep ticks. */
export function itemHash(text: string): string {
  return createHash("sha1").update(text.trim().toLowerCase()).digest("hex");
}

function notesOf(json: string | null): { actions: string[]; decisions: string[] } {
  let n: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json ?? "");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) n = parsed as Record<string, unknown>;
  } catch {
    // no notes yet, or notes that never parsed: nothing to show
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
  return { actions: list(n.actionItems ?? n.actions), decisions: list(n.keyDecisions ?? n.decisions) };
}

const newestFirst = (sessions: HomeSession[]) => [...sessions].sort((a, b) => b.at.getTime() - a.at.getTime());

/** Open action items, newest meeting first; `done` holds `${sessionId}:${itemHash}`. */
export function actionItems(sessions: HomeSession[], done: Set<string>, n: number) {
  return newestFirst(sessions)
    .flatMap((s) => notesOf(s.notesJson).actions.map((text) => ({ sessionId: s.id, meeting: s.name, at: s.at, text, hash: itemHash(text) })))
    .filter((i) => !done.has(`${i.sessionId}:${i.hash}`))
    .slice(0, n);
}

/** What the meetings agreed, newest meeting first. */
export function recentDecisions(sessions: HomeSession[], n: number) {
  return newestFirst(sessions)
    .flatMap((s) => notesOf(s.notesJson).decisions.map((text) => ({ sessionId: s.id, meeting: s.name, at: s.at, text })))
    .slice(0, n);
}

/** Monday to Friday of this week (Nairobi time), each with its sessions in time order. */
export function weekStrip(sessions: HomeSession[], now: Date) {
  const local = (d: Date) => new Date(d.getTime() + NAIROBI_OFFSET_MS); // read with getUTC* = Nairobi wall time
  const dayNo = (d: Date) => Math.floor(local(d).getTime() / DAY);
  const today = dayNo(now);
  const monday = today - ((local(now).getUTCDay() + 6) % 7);
  return [0, 1, 2, 3, 4].map((i) => {
    const day = monday + i;
    const date = new Date(day * DAY);
    return {
      label: `${DAYS[date.getUTCDay()]} ${date.getUTCDate()}`,
      today: day === today,
      items: sessions
        .filter((s) => dayNo(s.at) === day)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((s) => ({ id: s.id, name: s.name, time: local(s.at).toISOString().slice(11, 16) })),
    };
  });
}
