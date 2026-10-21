import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settleSentMessage } from "./thread";

describe("settleSentMessage", () => {
  const tmp = { id: "tmp-1", body: "hi" };
  const saved = { id: "m1", body: "hi" };

  it("swaps the temporary bubble for the saved message", () => {
    assert.deepEqual(settleSentMessage([{ id: "m0", body: "a" }, tmp], "tmp-1", saved), [{ id: "m0", body: "a" }, saved]);
  });

  it("drops the temporary bubble when Pusher already delivered the saved message (no double)", () => {
    const list = settleSentMessage([tmp, saved], "tmp-1", saved);
    assert.deepEqual(list, [saved]);
  });
});
