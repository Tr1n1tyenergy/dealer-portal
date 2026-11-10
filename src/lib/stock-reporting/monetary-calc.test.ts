import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  closeShiftBlock,
  computeMonetarySummary,
  MONETARY_CLOSE_TOLERANCE_KES,
  expectedAmountKes,
  parseKesInput,
} from "./monetary-calc";

describe("expectedAmountKes", () => {
  it("matches mockup PMS and AGO expected amounts", () => {
    assert.equal(expectedAmountKes(10000, 200), 2_000_000);
    assert.equal(expectedAmountKes(10000, 190), 1_900_000);
  });
});

describe("computeMonetarySummary", () => {
  it("matches mockup balanced collections", () => {
    const s = computeMonetarySummary({
      meterPms: 10000,
      meterAgo: 10000,
      pricePms: 200,
      priceAgo: 190,
      cashKes: 1_200_000,
      mpesaKes: 1_700_000,
      cardKes: 1_000_000,
    });
    assert.equal(s.expectedTotalKes, 3_900_000);
    assert.equal(s.collectionsTotalKes, 3_900_000);
    assert.equal(s.differenceKes, 0);
    assert.equal(s.state, "BALANCED");
  });

  it("preserves signed shortage and overage", () => {
    const shortage = computeMonetarySummary({
      meterPms: 10000,
      meterAgo: 10000,
      pricePms: 200,
      priceAgo: 190,
      cashKes: 1_150_000,
      mpesaKes: 1_700_000,
      cardKes: 1_000_000,
    });
    assert.equal(shortage.differenceKes, -50_000);
    assert.equal(shortage.state, "SHORTAGE");

    const overage = computeMonetarySummary({
      meterPms: 10000,
      meterAgo: 10000,
      pricePms: 200,
      priceAgo: 190,
      cashKes: 1_250_000,
      mpesaKes: 1_700_000,
      cardKes: 1_000_000,
    });
    assert.equal(overage.differenceKes, 50_000);
    assert.equal(overage.state, "OVERAGE");
  });

  it("treats blank collections as incomplete, not zero", () => {
    const s = computeMonetarySummary({
      meterPms: 10000,
      meterAgo: 10000,
      pricePms: 200,
      priceAgo: 190,
      cashKes: null,
      mpesaKes: null,
      cardKes: null,
    });
    assert.equal(s.state, "INCOMPLETE");
    assert.equal(s.collectionsTotalKes, null);
    assert.equal(s.differenceKes, null);
  });
});

describe("parseKesInput", () => {
  it("rejects negatives and invalid text", () => {
    assert.equal(parseKesInput("-1"), null);
    assert.equal(parseKesInput("abc"), null);
    assert.equal(parseKesInput("1,200,000.00"), 1_200_000);
  });
});

describe("closeShiftBlock", () => {
  const summary = (cash: number) =>
    computeMonetarySummary({ meterPms: 1000, meterAgo: 0, pricePms: 200, priceAgo: 200, cashKes: cash, mpesaKes: 0, cardKes: 0 });

  it("closes an exact balance with no note", () => {
    assert.equal(closeShiftBlock(summary(200_000), null), null);
  });

  it("closes a difference within the tolerance with no note", () => {
    assert.equal(MONETARY_CLOSE_TOLERANCE_KES, 100);
    assert.equal(closeShiftBlock(summary(200_000 - 100), null), null);
    assert.equal(closeShiftBlock(summary(200_000 + 100), ""), null);
  });

  it("asks for an explanation beyond the tolerance", () => {
    assert.match(closeShiftBlock(summary(200_000 - 100.01), null) ?? "", /shortage of KES 100\.01.*explanation/i);
    assert.match(closeShiftBlock(summary(200_500), "short") ?? "", /overage of KES 500\.00.*explanation/i);
  });

  it("closes beyond the tolerance once a real explanation is given", () => {
    assert.equal(closeShiftBlock(summary(150_000), "Pump 2 card terminal was offline"), null);
  });

  it("never closes while collections are incomplete", () => {
    const s = computeMonetarySummary({ meterPms: 1000, meterAgo: 0, pricePms: 200, priceAgo: 200, cashKes: 1, mpesaKes: null, cardKes: 0 });
    assert.match(closeShiftBlock(s, "Pump 2 card terminal was offline") ?? "", /collections/i);
  });
});
