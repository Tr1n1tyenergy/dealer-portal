import { prisma } from "@/lib/prisma";
import { generateStructuredNotes } from "@/lib/notes";

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
