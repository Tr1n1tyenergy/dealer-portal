import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { returnPathAfterReview, reviewReturnPath } from "./internal-order-actions";

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

describe("after a payment review", () => {
  const back = "/intelligence/retail/orders/o1";
  it("goes back to the order only when the review went through", () => {
    assert.equal(returnPathAfterReview("done", back, "o1"), back);
  });
  it("stays on the payment page when Odoo refused, so staff see the error", () => {
    assert.equal(returnPathAfterReview("odoo-failed", back, "o1"), null);
  });
  it("stays put when the action was refused", () => {
    assert.equal(returnPathAfterReview("refused", back, "o1"), null);
  });
});
