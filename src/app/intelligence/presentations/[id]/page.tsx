import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canUser } from "@/lib/permissions";
import { parseJsonObject } from "@/lib/utils";
import type { PresentationSlide } from "@/lib/notes";
import { ModuleShell } from "@/components/module-shell/module-shell";
import { PresenterView } from "@/components/presentations/presenter-view";

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!canUser(auth.user, "presDecks", "view")) redirect("/intelligence/dashboard");
  const { id } = await params;
  const presentation = await prisma.presentation.findFirst({
    where: { id, ...(auth.user.role === "SUPER_ADMIN" ? {} : { userId: auth.user.id }) },
  });
  if (!presentation) notFound();

  return (
    <ModuleShell user={auth.user} current="presentations">
      <PresenterView
        title={presentation.title}
        theme={presentation.theme}
        slides={parseJsonObject<PresentationSlide[]>(presentation.slidesJson) ?? []}
      />
    </ModuleShell>
  );
}
