import { test } from "node:test";
import assert from "node:assert/strict";
import { actionItems, itemHash, recentDecisions, weekStrip } from "./home-items";

const s = (id: string, at: string, notes: unknown) => ({ id, name: `Meeting ${id}`, at: new Date(at), notesJson: notes === undefined ? null : typeof notes === "string" ? notes : JSON.stringify(notes) });

test("itemHash ignores case and surrounding space", () => {
  assert.equal(itemHash("  Send the plan "), itemHash("send the plan"));
  assert.match(itemHash("x"), /^[0-9a-f]{40}$/);
});

test("actionItems: newest meeting first, done ones hidden, both key names, bad JSON is empty", () => {
  const sessions = [
    s("a", "2026-11-02T08:00:00Z", { actionItems: ["Old one"] }),
    s("b", "2026-11-03T08:00:00Z", { actions: ["Send plan", "Book trucks"] }),
    s("c", "2026-11-04T08:00:00Z", "{not json"),
    s("d", "2026-11-04T09:00:00Z", undefined),
  ];
  const done = new Set([`b:${itemHash("Book trucks")}`]);
  const items = actionItems(sessions, done, 5);
  assert.deepEqual(items.map((i) => i.text), ["Send plan", "Old one"]);
  assert.equal(items[0].sessionId, "b");
  assert.equal(items[0].meeting, "Meeting b");
  assert.equal(actionItems(sessions, done, 1).length, 1);
});

test("recentDecisions reads keyDecisions and decisions", () => {
  const d = recentDecisions([s("a", "2026-11-02T08:00:00Z", { keyDecisions: ["K1"] }), s("b", "2026-11-03T08:00:00Z", { decisions: ["D1", "D2"] })], 3);
  assert.deepEqual(d.map((x) => x.text), ["D1", "D2", "K1"]);
});

test("weekStrip: Mon to Fri in Nairobi time; a Sunday 23:30Z session is Monday", () => {
  const now = new Date("2026-11-04T09:00:00Z"); // Wed 4 Nov, Nairobi
  const week = weekStrip([s("m", "2026-11-01T23:30:00Z", undefined), s("w", "2026-11-04T08:00:00Z", undefined), s("sat", "2026-11-07T08:00:00Z", undefined)], now);
  assert.deepEqual(week.map((d) => d.label), ["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6"]);
  assert.deepEqual(week[0].items.map((i) => i.id), ["m"]);
  assert.deepEqual(week[2].items.map((i) => i.id), ["w"]);
  assert.equal(week[2].today, true);
  assert.equal(week.flatMap((d) => d.items).length, 2);
  assert.equal(week[0].items[0].time, "02:30");
});
