import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PresentationsClient } from "./presentations-client";

export default async function PresentationsPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === "SUPER_ADMIN";

  const [noteSessions, presentations] = await Promise.all([
    prisma.noteSession.findMany({
      where: {
        status: "COMPLETED",
        ...(isAdmin ? {} : { userId: session.user.id }),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.presentation.findMany({
      where: isAdmin ? undefined : { userId: session.user.id },
      include: { noteSession: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Executive Briefings
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Presentations</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Convert meeting notes into leadership-ready decks with fullscreen presentation mode.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading...</div>}>
        <PresentationsClient
          sessions={noteSessions.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            createdAt: s.createdAt.toISOString(),
          }))}
          presentations={presentations.map((p) => ({
            id: p.id,
            title: p.title,
            createdAt: p.createdAt.toISOString(),
            noteSession: p.noteSession ? { name: p.noteSession.name } : null,
          }))}
        />
      </Suspense>
    </AppShell>
  );
}
