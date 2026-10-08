import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { RecordingStudio } from "@/components/note-taker/recording-studio";
import { Button } from "@/components/ui/button";
import "@/components/note-taker/recording-countdown.css";
import "@/components/note-taker/recording-live.css";

export default async function NoteSessionPage({
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

  if (session.status === "COMPLETED") {
    return (
      <AppShell>
        <div className="card-premium p-8">
          <h1 className="text-2xl font-black text-trinity-navy">{session.name}</h1>
          <p className="mt-2 text-slate-500">This session is complete.</p>
          <div className="mt-6">
            <Link href={`/intelligence/note-taker/${session.id}/notes`}>
              <Button>View Meeting Notes</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (session.status === "SCHEDULED") {
    return (
      <AppShell>
        <div className="card-premium p-8">
          <div className="text-xs font-bold uppercase tracking-wider text-trinity-gold">
            Scheduled
          </div>
          <h1 className="mt-2 text-3xl font-black text-trinity-navy">{session.name}</h1>
          <p className="mt-3 text-slate-500">
            Scheduled for {session.scheduledAt?.toLocaleString() ?? "soon"}.
          </p>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              const { redirect } = await import("next/navigation");
              await prisma.noteSession.update({
                where: { id: session.id },
                data: { status: "COUNTDOWN" },
              });
              redirect(`/intelligence/note-taker/${session.id}`);
            }}
          >
            <Button type="submit">Start Countdown</Button>
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <RecordingStudio
        session={{
          id: session.id,
          name: session.name,
          status: session.status,
          startedAt: session.startedAt?.toISOString(),
          timeLimitSeconds: session.timeLimitSeconds,
        }}
      />
    </AppShell>
  );
}
