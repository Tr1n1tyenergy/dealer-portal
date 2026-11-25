import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePresentationSlides, type MeetingNotes } from "./notes";

const notes: MeetingNotes = {
  meetingOverview: "Overview",
  attendees: ["Wanjiru Kamau"],
  discussionTopics: ["Prices"],
  keyDecisions: ["Use the 15 Nov list"],
  actionItems: ["Send the price sheet"],
  risks: [],
  opportunities: ["Lubricants"],
  followUpTasks: ["Review Kisii"],
  summary: "Summary",
};
const base = { meetingName: "Pricing check-in", dateLabel: "4 Nov 2026", presenter: "Wanjiru Kamau", notes };

test("only the chosen sections are made, and the title slide is always first", () => {
  const ids = generatePresentationSlides({ ...base, sections: ["decisions", "actions"] }).map((s) => s.id);
  assert.deepEqual(ids, ["title", "decisions", "actions"]);
});

test("sections with nothing in them are left out instead of making an empty slide", () => {
  const ids = generatePresentationSlides(base).map((s) => s.id);
  assert.deepEqual(ids, ["title", "summary", "topics", "decisions", "actions", "opportunities", "next"]);
});

test("the title slide names the presenter", () => {
  assert.equal(generatePresentationSlides(base)[0].subtitle, "4 Nov 2026 · Wanjiru Kamau");
});
