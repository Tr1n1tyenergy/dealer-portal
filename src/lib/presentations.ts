import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { generatePresentationSlides, type DeckSection, type MeetingNotes } from "@/lib/notes";
import { parseJsonObject } from "@/lib/utils";

export const DECK_THEMES = ["light", "navy", "photo", "warm"] as const;
export type DeckTheme = (typeof DECK_THEMES)[number];

/**
 * Makes a deck from finished meeting notes. Notes can have one deck (unique key), so a second
 * request returns the existing deck's id instead of failing.
 */
export async function createDeck(
  who: { userId: string; isAdmin: boolean; defaultPresenter: string },
  input: { noteSessionId: string; presenter?: string; sections?: DeckSection[]; theme?: DeckTheme },
) {
  const noteSession = await prisma.noteSession.findFirst({
    where: { id: input.noteSessionId, status: "COMPLETED", ...(who.isAdmin ? {} : { userId: who.userId }) },
    include: { presentation: { select: { id: true } } },
  });
  if (!noteSession) return { notFound: true as const };
  if (noteSession.presentation) return { existingId: noteSession.presentation.id };

  const notes =
    parseJsonObject<MeetingNotes>(noteSession.notesJson) ??
    ({
      meetingOverview: noteSession.name, attendees: [], discussionTopics: [], keyDecisions: [], actionItems: [],
      risks: [], opportunities: [], followUpTasks: [], summary: noteSession.name,
    } satisfies MeetingNotes);
  const presenter = input.presenter?.trim() || who.defaultPresenter;

  const presentation = await prisma.presentation.create({
    data: {
      title: noteSession.name,
      userId: who.userId,
      noteSessionId: noteSession.id,
      presenter,
      theme: input.theme ?? "light",
      slidesJson: JSON.stringify(
        generatePresentationSlides({
          meetingName: noteSession.name,
          dateLabel: format(noteSession.endedAt ?? noteSession.createdAt, "dd MMM yyyy"),
          presenter,
          notes,
          sections: input.sections,
        }),
      ),
    },
  });
  return { presentation };
}
