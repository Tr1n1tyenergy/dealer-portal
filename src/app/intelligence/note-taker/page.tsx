import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { NoteTakerHome } from "@/components/note-taker/note-taker-home";

export default async function NoteTakerPage() {
  const session = await requireSession();
  if (!canUser(session.user, "noteSessions", "view")) redirect("/intelligence/dashboard");
  const mine = session.user.role === "SUPER_ADMIN" ? undefined : { userId: session.user.id };
  const canDecks = canUser(session.user, "presDecks", "view");

  const [sessions, deckCount] = await Promise.all([
    prisma.noteSession.findMany({ where: mine, orderBy: { createdAt: "desc" }, take: 200 }),
    canDecks ? prisma.presentation.count({ where: mine }) : 0,
  ]);

  return (
    <ModuleShell user={session.user} current="note-taker">
      <NoteTakerHome
        canDecks={canDecks}
        deckCount={deckCount}
        sessions={sessions.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          scheduledAt: s.scheduledAt?.toISOString() ?? null,
          startedAt: s.startedAt?.toISOString() ?? null,
          durationSeconds: s.durationSeconds,
          notesStatus: s.notesStatus,
          notesJson: s.notesJson,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </ModuleShell>
  );
}
