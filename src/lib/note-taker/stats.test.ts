import { test } from "node:test";
import assert from "node:assert/strict";
import { noteTakerStats } from "./stats";

const now = new Date("2026-11-20T09:00:00Z");
const s = (startedAt: string | null, durationSeconds: number | null, notesStatus = "PENDING", status = "COMPLETED") => ({
  status,
  startedAt,
  createdAt: startedAt ?? "2026-11-01T08:00:00Z",
  durationSeconds,
  notesStatus,
});

test("no sessions: zeros and no trend, never sample numbers", () => {
  assert.deepEqual(noteTakerStats([], now), {
    meetings: 0, hours: 0, notes: 0, trend: { meetings: null, hours: null, notes: null },
  });
});

test("counts this Nairobi month only and compares with last month", () => {
  const rows = [
    s("2026-11-03T07:00:00Z", 3600, "READY"),
    s("2026-11-10T07:00:00Z", 5400, "READY"),
    s("2026-10-31T22:30:00Z", 1800), // 1 Nov in Nairobi
    s("2026-10-15T07:00:00Z", 3600, "READY"),
    s(null, null, "PENDING", "SCHEDULED"), // not recorded
  ];
  const r = noteTakerStats(rows, now);
  assert.equal(r.meetings, 3);
  assert.equal(r.hours, 3); // 1 h + 1.5 h + 0.5 h
  assert.equal(r.notes, 2);
  assert.deepEqual(r.trend, { meetings: 200, hours: 200, notes: 100 });
});

test("nothing last month: no percentage", () => {
  const r = noteTakerStats([s("2026-11-03T07:00:00Z", 3600, "READY")], now);
  assert.deepEqual(r.trend, { meetings: null, hours: null, notes: null });
});
