import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { likeLiteral } from "./search";

describe("search text", () => {
  it("escapes LIKE wildcards so they match literally", () => {
    assert.equal(likeLiteral("%"), "\\%");
    assert.equal(likeLiteral("a_b"), "a\\_b");
    assert.equal(likeLiteral("back\\slash"), "back\\\\slash");
    assert.equal(likeLiteral("Nakuru"), "Nakuru");
  });
});
