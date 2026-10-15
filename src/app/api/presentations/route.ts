import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi, jsonError } from "@/lib/api-auth";
import { generatePresentationSlides, type MeetingNotes } from "@/lib/notes";
import { parseJsonObject } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { format } from "date-fns";
import { INVALID_JSON, readJson } from "@/lib/http/read-json";

const createSchema = z.object({
  noteSessionId: z.string().min(1).max(200),
  presenter: z.string().max(2000).optional(),
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

  const isAdmin = auth.session.user.role === "SUPER_ADMIN";
  const noteSession = await prisma.noteSession.findFirst({
    where: {
      id: parsed.data.noteSessionId,
      ...(isAdmin ? {} : { userId: auth.session.user.id }),
      status: "COMPLETED",
    },
  });

  if (!noteSession) return jsonError("Completed meeting notes not found.", 404);

  const notes =
    parseJsonObject<MeetingNotes>(noteSession.notesJson) ??
    ({
      meetingOverview: noteSession.name,
      attendees: [],
      discussionTopics: [],
      keyDecisions: [],
      actionItems: [],
      risks: [],
      opportunities: [],
      followUpTasks: [],
      summary: noteSession.name,
    } satisfies MeetingNotes);

  const presenter =
    parsed.data.presenter ??
    `${auth.session.user.firstName} ${auth.session.user.lastName}`;

  const slides = generatePresentationSlides({
    meetingName: noteSession.name,
    dateLabel: format(noteSession.endedAt ?? noteSession.createdAt, "dd MMM yyyy"),
    presenter,
    notes,
  });

  const presentation = await prisma.presentation.create({
    data: {
      title: `${noteSession.name} — Executive Deck`,
      userId: auth.session.user.id,
      noteSessionId: noteSession.id,
      presenter,
      slidesJson: JSON.stringify(slides),
    },
  });

  await logActivity({
    actorId: auth.session.user.id,
    action: "PRESENTATION_CREATED",
    entity: "Presentation",
    entityId: presentation.id,
  });

  return NextResponse.json({ presentation }, { status: 201 });
}
