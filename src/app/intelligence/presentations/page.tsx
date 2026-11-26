import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { parseJsonObject } from "@/lib/utils";
import { nairobiMonthStart } from "@/lib/time/nairobi";
import type { PresentationSlide } from "@/lib/notes";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { DecksHome } from "@/components/presentations/decks-home";

export default async function PresentationsPage() {
  const session = await requireSession();
  if (!canUser(session.user, "presDecks", "view")) redirect("/intelligence/dashboard");
  const mine = session.user.role === "SUPER_ADMIN" ? {} : { userId: session.user.id };

  const [decks, waiting] = await Promise.all([
    prisma.presentation.findMany({ where: mine, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.noteSession.findMany({
      where: { ...mine, status: "COMPLETED", notesStatus: "READY", presentation: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const monthStart = nairobiMonthStart(new Date()).getTime();
  const rows = decks
    .map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
      presenter: p.presenter,
      theme: p.theme,
      slides: parseJsonObject<PresentationSlide[]>(p.slidesJson) ?? [],
    }))
    .filter((d) => d.slides.length);

  return (
    <ModuleShell user={session.user} current="presentations">
      <DecksHome
        decks={rows}
        monthCount={decks.filter((d) => d.createdAt.getTime() >= monthStart).length}
        waiting={waiting.map((s) => ({ id: s.id, name: s.name, when: (s.endedAt ?? s.createdAt).toISOString() }))}
      />
    </ModuleShell>
  );
}
