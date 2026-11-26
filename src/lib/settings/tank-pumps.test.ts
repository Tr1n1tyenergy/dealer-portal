import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeNumericText } from "@/lib/forms/numeric-text";
import {
  parsePumpCount,
  planPumpAdjustment,
  pumpCountSentence,
  pumpKeyForTank,
  slotsFromPumps,
} from "@/lib/settings/tank-pumps";

describe("pump count", () => {
  it("accepts a positive whole number", () => {
    assert.deepEqual(parsePumpCount("4"), { ok: true, count: 4 });
  });

  it("rejects zero, fractions, and letters", () => {
    assert.equal(parsePumpCount("0").ok, false);
    assert.equal(parsePumpCount("1.5").ok, false);
    assert.equal(parsePumpCount("-2").ok, false);
    assert.equal(parsePumpCount("4 pumps").ok, false);
  });
});

describe("pump plan", () => {
  const pumps = slotsFromPumps([
    { id: "a", pumpKey: "PMS-1-P1", label: "Pump 1", active: true },
    { id: "b", pumpKey: "PMS-1-P2", label: "Pump 2", active: true },
    { id: "c", pumpKey: "PMS-1-P3", label: "Pump 3", active: false },
  ]);

  it("creates the next indexes and keeps capacity independent of the count", () => {
    const plan = planPumpAdjustment(pumps, 4);
    assert.deepEqual(plan.reactivateIds, ["c"]);
    assert.deepEqual(plan.createIndexes, [4]);
    assert.equal(pumpKeyForTank("PMS-1", 4), "PMS-1-P4");
    assert.equal(plan.deactivate.length, 0);
  });

  it("names the pumps that would be retired without deleting them", () => {
    const plan = planPumpAdjustment(pumps, 1);
    assert.deepEqual(
      plan.deactivate.map((pump) => pump.id),
      ["b"]
    );
    assert.deepEqual(plan.createIndexes, []);
  });

  it("uses singular wording for one pump", () => {
    assert.equal(pumpCountSentence(1), "One pump will be automatically created and linked to this tank.");
    assert.match(pumpCountSentence(4), /^Four pumps /);
  });
});

describe("numeric text", () => {
  it("keeps digits and a single decimal point", () => {
    assert.equal(sanitizeNumericText("12a3.32.1kes", true), "123.321");
    assert.equal(sanitizeNumericText("12a3", false), "123");
    assert.equal(sanitizeNumericText("-4", false), "4");
    assert.equal(sanitizeNumericText("227231", true), "227,231");
    assert.equal(sanitizeNumericText("1234567.891", true), "1,234,567.891");
    assert.equal(sanitizeNumericText("227231.", true), "227,231.");
    assert.equal(sanitizeNumericText("1000000", false), "1,000,000");
  });
});
