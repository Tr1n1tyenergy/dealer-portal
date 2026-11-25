import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewReturnPath } from "./internal-order-actions";

describe("where a payment review sends staff afterwards", () => {
  it("goes back to the order when asked", () => {
    assert.equal(reviewReturnPath("/intelligence/retail/orders/cmwok02il0004", "cmwok02il0004"), "/intelligence/retail/orders/cmwok02il0004");
  });

  it("refuses anything else (another order, another site, odd paths)", () => {
    assert.equal(reviewReturnPath("/intelligence/retail/orders/other", "mine"), null);
    assert.equal(reviewReturnPath("https://evil.test/intelligence/retail/orders/mine", "mine"), null);
    assert.equal(reviewReturnPath("//evil.test", "mine"), null);
    assert.equal(reviewReturnPath(null, "mine"), null);
  });
});
