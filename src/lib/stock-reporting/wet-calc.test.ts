import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeWetVariances } from "./wet-calc";

describe("computeWetVariances", () => {
  it("matches mockup meter vs tank example", () => {
    const v = computeWetVariances({
      meterPms: 10_000,
      meterAgo: 10_000,
      tankPms: 9_950,
      tankAgo: 9_970,
    });
    assert.equal(v.variancePms, 50);
    assert.equal(v.varianceAgo, 30);
    assert.equal(v.varianceTotal, 80);
    assert.equal(v.absoluteVariance, 80);
    assert.equal(v.balanced, false);
  });

  it("preserves opposite-sign product variances", () => {
    const v = computeWetVariances({
      meterPms: 100,
      meterAgo: 100,
      tankPms: 50,
      tankAgo: 130,
    });
    assert.equal(v.variancePms, 50);
    assert.equal(v.varianceAgo, -30);
    assert.equal(v.varianceTotal, 20);
    assert.equal(v.absoluteVariance, 80);
  });

  it("detects balanced report", () => {
    const v = computeWetVariances({
      meterPms: 1_000,
      meterAgo: 500,
      tankPms: 1_000,
      tankAgo: 500,
    });
    assert.equal(v.balanced, true);
    assert.equal(v.absoluteVariance, 0);
  });
});
