import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import {
  NoteTakerDashboard,
  type NoteSessionRow,
} from "@/components/note-taker/note-taker-dashboard";

export default async function NoteTakerPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === "SUPER_ADMIN";

  const sessions = await prisma.noteSession.findMany({
    where: isAdmin ? undefined : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const rows: NoteSessionRow[] = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    scheduledAt: s.scheduledAt?.toISOString() ?? null,
    startedAt: s.startedAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    durationSeconds: s.durationSeconds,
    participants: s.participants,
    transcriptStatus: s.transcriptStatus,
    notesStatus: s.notesStatus,
    notesJson: s.notesJson,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <AppShell>
      <NoteTakerDashboard sessions={rows} />
    </AppShell>
  );
}
