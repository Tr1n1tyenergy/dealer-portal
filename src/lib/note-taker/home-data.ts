import { prisma } from "@/lib/prisma";
import { actionItems, recentDecisions, weekStrip, type HomeSession } from "./home-items";

const DAY = 86400e3;
const countOf = (json: string) => {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
};

/** Everything the Home's meeting cards need for one person: their sessions, ticks and decks. */
export async function meetingHome(userId: string, now: Date) {
  const [rows, done, decks] = await Promise.all([
    prisma.noteSession.findMany({
      where: { userId, status: { not: "CANCELLED" }, OR: [{ createdAt: { gte: new Date(now.getTime() - 60 * DAY) } }, { scheduledAt: { gte: new Date(now.getTime() - 7 * DAY) } }] },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, name: true, status: true, scheduledAt: true, startedAt: true, createdAt: true, durationSeconds: true, timeLimitSeconds: true, participants: true, notesStatus: true, transcriptStatus: true, notesJson: true },
    }),
    prisma.actionItemDone.findMany({ where: { userId }, select: { noteSessionId: true, itemHash: true } }),
    prisma.presentation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 2, select: { id: true, title: true, slidesJson: true, createdAt: true } }),
  ]);
  const sessions = rows.map((r) => ({ ...r, at: r.scheduledAt ?? r.startedAt ?? r.createdAt, people: countOf(r.participants) }));
  const home: HomeSession[] = sessions;
  const doneSet = new Set(done.map((d) => `${d.noteSessionId}:${d.itemHash}`));
  const allOpen = actionItems(home, doneSet, 1000);
  const next = sessions.filter((s) => s.status === "SCHEDULED" && s.scheduledAt && s.scheduledAt >= now).sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
  // "Ready to read" = notes finished in the last 7 days; there is no read receipt to know what was opened
  const ready = sessions.filter((s) => s.notesStatus === "READY" && s.at.getTime() >= now.getTime() - 7 * DAY);
  return {
    hasAny: sessions.length > 0 || decks.length > 0,
    next,
    ready,
    openCount: allOpen.length,
    openMeetings: new Set(allOpen.map((i) => i.sessionId)).size,
    items: allOpen.slice(0, 5),
    decisions: recentDecisions(home, 3),
    week: weekStrip(home, now),
    meetings: sessions.slice().sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 4),
    decks: decks.map((d) => ({ id: d.id, title: d.title, slides: countOf(d.slidesJson), createdAt: d.createdAt })),
  };
}
