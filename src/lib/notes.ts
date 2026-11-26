export type MeetingNotes = {
  meetingOverview: string;
  attendees: string[];
  discussionTopics: string[];
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  opportunities: string[];
  followUpTasks: string[];
  summary: string;
  /** Indexes of actionItems ticked as done on the notes page. */
  doneActions?: number[];
};

export function generateStructuredNotes(params: {
  sessionName: string;
  participants: string[];
  durationSeconds?: number | null;
}): MeetingNotes {
  const attendees = params.participants.length
    ? params.participants
    : ["To be confirmed"];

  return {
    meetingOverview: `${params.sessionName} — structured notes captured by Trinity Retail Intelligence. AI enrichment pipeline is wired for future Whisper/OpenAI integration.`,
    attendees,
    discussionTopics: [
      "Retail performance and station operations",
      "Commercial supply and inventory cadence",
      "Customer experience and service quality",
    ],
    keyDecisions: [
      "Proceed with next reporting cycle using TRI Retail Reports",
      "Capture follow-up owners for priority actions",
    ],
    actionItems: [
      "Distribute notes to attendees",
      "Validate transcript once AI pipeline is enabled",
      "Generate executive presentation from this session",
    ],
    risks: [
      "Incomplete attendance list until participants are confirmed",
      "Transcription pending AI layer activation",
    ],
    opportunities: [
      "Use session output for leadership briefings",
      "Link notes directly into Presentations module",
    ],
    followUpTasks: [
      "Schedule review with retail operations",
      "Upload supporting documents to the session archive",
    ],
    summary: `${params.sessionName} completed. Notes, recording placeholder, and transcript status are available in the session archive.`,
  };
}

export type PresentationSlide = {
  id: string;
  title: string;
  bullets: string[];
  subtitle?: string;
};

/** The sections a deck can have after its title slide, in deck order, with the builder's labels. */
export const DECK_SECTIONS = [
  ["summary", "Summary"],
  ["topics", "What we discussed"],
  ["decisions", "Decisions"],
  ["actions", "Actions"],
  ["risks", "Risks"],
  ["opportunities", "Opportunities"],
  ["next", "Next steps"],
] as const;
export type DeckSection = (typeof DECK_SECTIONS)[number][0];
export const DECK_SECTION_KEYS = DECK_SECTIONS.map(([k]) => k) as [DeckSection, ...DeckSection[]];

export function generatePresentationSlides(params: {
  meetingName: string;
  dateLabel: string;
  presenter: string;
  notes: MeetingNotes;
  /** Sections to include; all when absent. The title slide is always kept. */
  sections?: DeckSection[];
}): PresentationSlide[] {
  const slides = buildSlides(params);
  return slides.filter(
    (s, i) =>
      i === 0 ||
      ((!params.sections || params.sections.includes(s.id as DeckSection)) && s.bullets.some(Boolean))
  );
}

function buildSlides(params: {
  meetingName: string;
  dateLabel: string;
  presenter: string;
  notes: MeetingNotes;
}): PresentationSlide[] {
  return [
    {
      id: "title",
      title: params.meetingName,
      subtitle: `${params.dateLabel} · ${params.presenter}`,
      bullets: ["Trinity Retail Intelligence", "Executive Briefing Deck"],
    },
    {
      id: "summary",
      title: "Executive Summary",
      bullets: [params.notes.summary, params.notes.meetingOverview],
    },
    {
      id: "topics",
      title: "Discussion Topics",
      bullets: params.notes.discussionTopics,
    },
    {
      id: "decisions",
      title: "Key Decisions",
      bullets: params.notes.keyDecisions,
    },
    {
      id: "actions",
      title: "Action Items",
      bullets: params.notes.actionItems,
    },
    {
      id: "risks",
      title: "Risks",
      bullets: params.notes.risks,
    },
    {
      id: "opportunities",
      title: "Opportunities",
      bullets: params.notes.opportunities,
    },
    {
      id: "next",
      title: "Next Steps",
      bullets: params.notes.followUpTasks,
    },
  ];
}
