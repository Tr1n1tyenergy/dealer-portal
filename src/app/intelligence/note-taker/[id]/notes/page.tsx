import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { parseJsonObject } from "@/lib/utils";
import {
  generateStructuredNotes,
  type MeetingNotes,
} from "@/lib/notes";
import { SessionNotesView } from "@/components/note-taker/session-notes-view";
import "@/components/note-taker/session-notes.css";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireSession();
  const { id } = await params;
  const isAdmin = auth.user.role === "SUPER_ADMIN";

  const session = await prisma.noteSession.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.user.id }),
    },
  });

  if (!session) notFound();

  const participants = parseJsonObject<string[]>(session.participants) ?? [];
  const notes =
    parseJsonObject<MeetingNotes>(session.notesJson) ??
    generateStructuredNotes({
      sessionName: session.name,
      participants,
      durationSeconds: session.durationSeconds,
    });

  return (
    <AppShell>
      <SessionNotesView
        session={{
          id: session.id,
          name: session.name,
          status: session.status,
          startedAt: session.startedAt?.toISOString() ?? session.createdAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          durationSeconds: session.durationSeconds,
          audioUrl: session.audioUrl,
          transcript: session.transcript,
          transcriptStatus: session.transcriptStatus,
          notesJson: session.notesJson,
          notes,
        }}
      />
    </AppShell>
  );
}
