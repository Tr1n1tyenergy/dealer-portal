import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { parseJsonObject } from "@/lib/utils";
import type { MeetingNotes } from "@/lib/notes";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { NotesReader } from "@/components/note-taker/notes-reader";

const TABS = ["summary", "decisions", "actions", "risks", "transcript"] as const;

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const auth = await requireSession();
  if (!canUser(auth.user, "noteSessions", "view")) redirect("/intelligence/dashboard");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const mine = auth.user.role === "SUPER_ADMIN" ? {} : { userId: auth.user.id };

  const [session, list] = await Promise.all([
    prisma.noteSession.findFirst({ where: { id, ...mine }, include: { presentation: { select: { id: true } } } }),
    prisma.noteSession.findMany({ where: { ...mine, status: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  if (!session) notFound();
  if (session.status !== "COMPLETED") redirect(`/intelligence/note-taker/${session.id}`);

  const when = (s: { startedAt: Date | null; createdAt: Date }) => (s.startedAt ?? s.createdAt).toISOString();
  const minutes = (s: { durationSeconds: number | null }) => Math.max(1, Math.round((s.durationSeconds ?? 0) / 60));

  return (
    <ModuleShell user={auth.user} current="note-taker">
      <NotesReader
        canDecks={canUser(auth.user, "presDecks", "view")}
        initialTab={TABS.find((t) => t === tab) ?? "summary"}
        list={list.map((s) => ({ id: s.id, name: s.name, when: when(s), minutes: minutes(s), ready: s.notesStatus === "READY" }))}
        current={{
          id: session.id,
          name: session.name,
          when: when(session),
          minutes: minutes(session),
          ready: session.notesStatus === "READY",
          notes: parseJsonObject<MeetingNotes>(session.notesJson) ?? null,
          transcript: session.transcript,
          transcriptReady: session.transcriptStatus === "READY",
          deckId: session.presentation?.id ?? null,
        }}
      />
    </ModuleShell>
  );
}
