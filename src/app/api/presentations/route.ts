import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { DECK_SECTION_KEYS } from "@/lib/notes";
import { createDeck, DECK_THEMES } from "@/lib/presentations";
import { logActivity } from "@/lib/activity";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const createSchema = z.object({
  noteSessionId: z.string().min(1).max(200),
  presenter: z.string().max(200).optional(),
  sections: z.array(z.enum(DECK_SECTION_KEYS)).max(10).optional(),
  theme: z.enum(DECK_THEMES).optional(),
});

export async function GET() {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  const isAdmin = auth.session.user.role === "SUPER_ADMIN";
  const presentations = await prisma.presentation.findMany({
    where: isAdmin ? undefined : { userId: auth.session.user.id },
    include: { noteSession: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ presentations });
}

export async function POST(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;

  const body = await readJson(req);
  if (body === undefined) return jsonError(INVALID_JSON, 400);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.flatten(), 400);

  const result = await createDeck(
    {
      userId: auth.session.user.id,
      isAdmin: auth.session.user.role === "SUPER_ADMIN",
      defaultPresenter: `${auth.session.user.firstName} ${auth.session.user.lastName}`,
    },
    parsed.data,
  );
  if ("notFound" in result) return jsonError("Completed meeting notes not found.", 404);
  if ("existingId" in result) {
    return NextResponse.json({ error: "These notes already have a deck.", id: result.existingId }, { status: 409 });
  }

  await logActivity({
    actorId: auth.session.user.id,
    action: "PRESENTATION_CREATED",
    entity: "Presentation",
    entityId: result.presentation.id,
  });

  return NextResponse.json({ presentation: result.presentation }, { status: 201 });
}
