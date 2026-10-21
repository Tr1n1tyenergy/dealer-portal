import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nairobiMonthStart, nairobiParts } from "./nairobi";
import { lastNMonthLabels, monthKey } from "@/lib/retail/analytics";

describe("Nairobi time (UTC+3)", () => {
  it("2 pm in Nairobi is afternoon, though the server clock says 11:00", () => {
    assert.equal(nairobiParts(new Date("2026-10-21T11:00:00Z")).hour, 14);
  });

  it("00:30 on 1 January in Nairobi is already the new year", () => {
    const p = nairobiParts(new Date("2026-12-31T21:30:00Z"));
    assert.deepEqual([p.year, p.month, p.day], [2027, 1, 1]);
  });

  it("a month starts at 00:00 Nairobi, which is 21:00 UTC the day before", () => {
    assert.equal(nairobiMonthStart(new Date("2026-11-01T01:00:00Z")).toISOString(), "2026-10-31T21:00:00.000Z");
    assert.equal(nairobiMonthStart(new Date("2026-11-01T01:00:00Z"), -1).toISOString(), "2026-09-30T21:00:00.000Z");
  });

  it("Analytics files an order from 00:30 on 1 Nov (Nairobi) under November", () => {
    assert.equal(monthKey(new Date("2026-10-31T21:30:00Z")), "2026-11");
    assert.deepEqual(
      lastNMonthLabels(2, new Date("2026-10-31T21:30:00Z")).map((m) => m.key),
      ["2026-10", "2026-11"],
    );
  });
});
