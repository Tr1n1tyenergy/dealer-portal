import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PresentationPlayer } from "@/components/presentations/presentation-player";
import { parseJsonObject } from "@/lib/utils";
import type { PresentationSlide } from "@/lib/notes";

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireSession();
  const { id } = await params;
  const isAdmin = auth.user.role === "SUPER_ADMIN";

  const presentation = await prisma.presentation.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId: auth.user.id }),
    },
  });

  if (!presentation) notFound();

  const slides = parseJsonObject<PresentationSlide[]>(presentation.slidesJson) ?? [];

  return (
    <AppShell>
      <PresentationPlayer title={presentation.title} slides={slides} />
    </AppShell>
  );
}
