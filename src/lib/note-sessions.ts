import { prisma } from "@/lib/prisma";
import { generateStructuredNotes, type MeetingNotes } from "@/lib/notes";
import { parseJsonObject } from "@/lib/utils";

export async function completeNoteSession(sessionId: string, userId: string) {
  const existing = await prisma.noteSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!existing) return null;

  const endedAt = new Date();
  const startedAt = existing.startedAt ?? endedAt;
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  let participants: string[] = [];
  try {
    participants = JSON.parse(existing.participants);
  } catch {
    participants = [];
  }

  const notes = generateStructuredNotes({
    sessionName: existing.name,
    participants,
    durationSeconds,
  });

  return prisma.noteSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt,
      startedAt,
      durationSeconds,
      audioUrl: existing.audioUrl ?? `pending://recording/${sessionId}`,
      transcriptStatus: "PENDING",
      transcript:
        "Live AI transcription pipeline is prepared for Whisper/OpenAI integration.",
      notesStatus: "READY",
      notesJson: JSON.stringify(notes),
    },
  });
}

/** Ticks or unticks one action item on the owner's notes. Returns the ticked indexes, or null if nothing changed. */
export async function toggleNoteAction(sessionId: string, userId: string, index: number) {
  const existing = await prisma.noteSession.findFirst({ where: { id: sessionId, userId } });
  const notes = parseJsonObject<MeetingNotes>(existing?.notesJson ?? null);
  if (!existing || !notes || !Number.isInteger(index) || index < 0 || index >= (notes.actionItems?.length ?? 0)) {
    return null;
  }
  const done = new Set(notes.doneActions ?? []);
  if (done.has(index)) done.delete(index);
  else done.add(index);
  const doneActions = [...done].sort((a, b) => a - b);
  await prisma.noteSession.update({
    where: { id: sessionId },
    data: { notesJson: JSON.stringify({ ...notes, doneActions }) },
  });
  return doneActions;
}
