import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receiptLevelLitres, validateReceiptAllocation } from "./stock-receipt";

const tanks = [
  {
    tankKey: "PMS-1",
    product: "PMS" as const,
    capacityLitres: 50_000,
    bookLitres: 20_000,
    alreadyInBook: false,
    previousLitres: 0,
    otherReportReceiptLitres: 0,
  },
  {
    tankKey: "AGO-1",
    product: "AGO" as const,
    capacityLitres: 40_000,
    bookLitres: 10_000,
    alreadyInBook: false,
    previousLitres: 0,
    otherReportReceiptLitres: 0,
  },
  {
    tankKey: "AGO-2",
    product: "AGO" as const,
    capacityLitres: 40_000,
    bookLitres: 10_000,
    alreadyInBook: false,
    previousLitres: 0,
    otherReportReceiptLitres: 0,
  },
];

describe("receiptLevelLitres", () => {
  it("adds a new receipt on top of the opening", () => {
    assert.equal(
      receiptLevelLitres({
        bookLitres: 20_000,
        alreadyInBook: false,
        previousLitres: 0,
        nextLitres: 30_000,
        otherReportReceiptLitres: 0,
      }),
      50_000
    );
  });

  it("replaces litres already folded into the book", () => {
    assert.equal(
      receiptLevelLitres({
        bookLitres: 50_000,
        alreadyInBook: true,
        previousLitres: 30_000,
        nextLitres: 25_000,
        otherReportReceiptLitres: 0,
      }),
      45_000
    );
  });
});

describe("validateReceiptAllocation", () => {
  it("accepts a full split across the tanks that received it", () => {
    const result = validateReceiptAllocation({
      orderedPms: 30_000,
      orderedAgo: 20_000,
      tanks,
      nextByTank: new Map([
        ["PMS-1", 30_000],
        ["AGO-1", 10_000],
        ["AGO-2", 10_000],
      ]),
    });
    assert.equal(result.ok, true);
  });

  it("accepts less than the order when the truck is short", () => {
    const result = validateReceiptAllocation({
      orderedPms: 30_000,
      orderedAgo: 20_000,
      tanks,
      nextByTank: new Map([
        ["PMS-1", 28_000],
        ["AGO-1", 10_000],
        ["AGO-2", 8_000],
      ]),
    });
    assert.equal(result.ok, true);
  });

  it("rejects more than the ordered product", () => {
    const result = validateReceiptAllocation({
      orderedPms: 30_000,
      orderedAgo: 20_000,
      tanks,
      nextByTank: new Map([["PMS-1", 30_001]]),
    });
    assert.equal(result.ok, false);
  });

  it("rejects a tank that would go over capacity", () => {
    const result = validateReceiptAllocation({
      orderedPms: 40_000,
      orderedAgo: 0,
      tanks,
      nextByTank: new Map([["PMS-1", 30_001]]),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.fieldErrors["PMS-1"] ?? "", /capacity/i);
  });
});
