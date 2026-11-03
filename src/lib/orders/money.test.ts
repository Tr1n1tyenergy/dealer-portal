import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKes, sameAmount, sumKes } from "./money";

describe("money display", () => {
  it("formats stored amounts as KES with commas and cents", () => {
    assert.equal(formatKes("43019000.00"), "KES 43,019,000.00");
    assert.equal(formatKes("1070150"), "KES 1,070,150.00");
    assert.equal(formatKes("1,070,150.5"), "KES 1,070,150.50");
  });

  it("shows a dash for no amount and the raw text for something that is not a number", () => {
    assert.equal(formatKes(null), "—");
    assert.equal(formatKes(""), "—");
    assert.equal(formatKes("-999999abc"), "-999999abc");
  });

  it("compares amounts to the cent, ignoring commas", () => {
    assert.equal(sameAmount("43019000.00", "43,019,000"), true);
    assert.equal(sameAmount("43019000.00", "43019000.01"), false);
    assert.equal(sameAmount("43019000.00", "abc"), false);
    assert.equal(sameAmount(null, "100"), false);
  });
});

describe("sumKes", () => {
  it("adds to the cent and skips blanks and text", () => {
    assert.equal(sumKes(["1225746.00", null, "0.10", "0.20", "abc"]), "1225746.30");
  });
  it("is 0.00 for nothing", () => {
    assert.equal(sumKes([]), "0.00");
  });
});
