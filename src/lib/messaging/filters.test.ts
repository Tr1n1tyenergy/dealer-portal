import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conversationFilters } from "./filters";

describe("conversationFilters", () => {
  it("gives staff all four filters", () => {
    assert.deepEqual(conversationFilters(false).map(([key]) => key), ["all", "dealers", "internal", "unread"]);
  });

  it("gives dealers only All and Unread (they only talk to Trinity staff)", () => {
    assert.deepEqual(conversationFilters(true), [
      ["all", "All"],
      ["unread", "Unread"],
    ]);
  });
});
