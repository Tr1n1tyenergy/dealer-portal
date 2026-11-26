import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { LiveRecorder } from "@/components/note-taker/live-recorder";

export default async function NoteSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!canUser(auth.user, "noteSessions", "view")) redirect("/intelligence/dashboard");
  const { id } = await params;
  const session = await prisma.noteSession.findFirst({
    where: { id, ...(auth.user.role === "SUPER_ADMIN" ? {} : { userId: auth.user.id }) },
  });
  if (!session) notFound();
  if (session.status === "COMPLETED") redirect(`/intelligence/note-taker/${session.id}/notes`);

  async function startNow() {
    "use server";
    const me = await requireSession();
    await prisma.noteSession.updateMany({
      where: { id, userId: me.user.id, status: "SCHEDULED" },
      data: { status: "COUNTDOWN" },
    });
    redirect(`/intelligence/note-taker/${id}`);
  }

  return (
    <ModuleShell user={auth.user} current="note-taker">
      <LiveRecorder
        key={session.status}
        startNow={session.userId === auth.user.id ? startNow : undefined}
        session={{
          id: session.id,
          name: session.name,
          status: session.status,
          startedAt: session.startedAt?.toISOString() ?? null,
          scheduledAt: session.scheduledAt?.toISOString() ?? null,
          timeLimitSeconds: session.timeLimitSeconds,
        }}
      />
    </ModuleShell>
  );
}
