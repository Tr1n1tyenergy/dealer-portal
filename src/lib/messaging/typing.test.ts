import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSendTyping, TYPING_EVERY_MS } from "./typing";

describe("shouldSendTyping", () => {
  it("sends on the first key press", () => {
    assert.equal(shouldSendTyping(null, 1_000), true);
  });

  it("stays quiet for 2 s after sending, then sends again", () => {
    assert.equal(TYPING_EVERY_MS, 2_000);
    assert.equal(shouldSendTyping(1_000, 1_500), false);
    assert.equal(shouldSendTyping(1_000, 2_999), false);
    assert.equal(shouldSendTyping(1_000, 3_000), true);
  });
});
