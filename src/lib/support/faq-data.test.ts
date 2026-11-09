import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAQ_ENTRIES, filterFaqs } from "./faq-data";

describe("filterFaqs", () => {
  it("returns all published entries for All with empty query", () => {
    const rows = filterFaqs({ category: "ALL", query: "" });
    assert.equal(rows.length, FAQ_ENTRIES.filter((e) => e.published).length);
    assert.equal(rows[0]?.id, "place-order");
  });

  it("filters by category", () => {
    const rows = filterFaqs({ category: "Technical", query: "" });
    assert.ok(rows.every((r) => r.category === "Technical"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "reset-password");
  });

  it("filters by search across question, answer, and keywords", () => {
    const rows = filterFaqs({ category: "ALL", query: "  password  " });
    assert.ok(rows.some((r) => r.id === "reset-password"));
    assert.ok(rows.every((r) => /password/i.test([r.question, r.answer, ...r.keywords].join(" "))));
  });

  it("combines category and search", () => {
    const rows = filterFaqs({ category: "Orders", query: "delivery" });
    assert.ok(rows.some((r) => r.id === "track-delivery"));
    assert.ok(rows.every((r) => r.category === "Orders"));
  });
});
