import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { parseJsonObject } from "@/lib/utils";
import type { MeetingNotes } from "@/lib/notes";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { DeckBuilder } from "@/components/presentations/deck-builder";

export default async function NewDeckPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const session = await requireSession();
  if (!canUser(session.user, "presDecks", "view")) redirect("/intelligence/dashboard");
  const { from } = await searchParams;
  const mine = session.user.role === "SUPER_ADMIN" ? {} : { userId: session.user.id };

  if (from) {
    const deck = await prisma.presentation.findFirst({ where: { noteSessionId: from, ...mine }, select: { id: true } });
    if (deck) redirect(`/intelligence/presentations/${deck.id}`);
  }
  const notes = await prisma.noteSession.findMany({
    where: { ...mine, status: "COMPLETED", notesStatus: "READY", presentation: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <ModuleShell user={session.user} current="presentations">
      <DeckBuilder
        from={from ?? null}
        me={[session.user.firstName, session.user.lastName].filter(Boolean).join(" ") || "Me"}
        options={notes.flatMap((s) => {
          const n = parseJsonObject<MeetingNotes>(s.notesJson);
          return n ? [{ id: s.id, name: s.name, when: (s.endedAt ?? s.createdAt).toISOString(), notes: n }] : [];
        })}
      />
    </ModuleShell>
  );
}
