import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffTicketFilters } from "./staff-views";

const NOW = new Date("2026-11-11T06:00:00Z");

describe("staff ticket filters", () => {
  it("defaults: all statuses, page 1, 8 rows, no filters, conversation tab", () => {
    const f = staffTicketFilters({}, NOW);
    assert.deepEqual(
      [f.status, f.department, f.dealerId, f.priority, f.page, f.rows, f.sel, f.tab, f.range],
      ["ALL", "ALL", null, null, 1, 8, null, "conversation", null]
    );
  });

  it("accepts valid values, drops junk, clamps rows to the allowed sizes", () => {
    const f = staffTicketFilters(
      { status: "RESOLVED", dept: "OPERATIONS", dealer: "ck1", priority: "HIGH", page: "2", rows: "25", t: "ck9", tab: "history", period: "30d" },
      NOW
    );
    assert.deepEqual(
      [f.status, f.department, f.dealerId, f.priority, f.page, f.rows, f.sel, f.tab],
      ["RESOLVED", "OPERATIONS", "ck1", "HIGH", 2, 25, "ck9", "history"]
    );
    assert.equal(f.range?.gte.toISOString(), "2026-10-12T21:00:00.000Z"); // 30 days back, Nairobi midnight
    assert.equal(staffTicketFilters({ rows: "7" }, NOW).rows, 8);
    assert.equal(staffTicketFilters({ status: "JUNK" }, NOW).status, "ALL");
    assert.equal(staffTicketFilters({ tab: "junk" }, NOW).tab, "conversation");
  });
});
