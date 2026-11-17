import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { goneQuiet, litresByWarehouse, topDealers } from "./dealers";
import type { InsightOrder } from "./live";

const DAY = 86_400_000;
const now = new Date("2026-11-17T12:00:00Z");
const lastMonth = new Date("2026-10-10T09:00:00Z");

let n = 0;
function order(stationCode: string | null, dealerName: string, litres: number, createdAt = now, status: InsightOrder["status"] = "AWAITING_PAYMENT"): InsightOrder {
  n += 1;
  return {
    id: `o${n}`,
    reference: `DO-${n}`,
    status,
    createdAt,
    updatedAt: createdAt,
    dealerName,
    stationName: stationCode ?? "?",
    stationCode,
    amountDue: null,
    lines: [{ product: "PMS", quantityLitres: litres }],
  };
}

describe("litresByWarehouse", () => {
  it("groups this month and last month by the station's loading warehouse", () => {
    const rows = litresByWarehouse(
      [
        order("athiriver", "Oilden", 10_000),
        order("magumu", "Beekey", 5_000),
        order("kitale", "Pery", 8_000),
        order("kitale", "Pery", 3_000, lastMonth),
        order("nowhere", "Mystery", 1_000),
        order(null, "Mystery", 500),
        order("athiriver", "Oilden", 99_000, now, "CANCELLED"),
      ],
      now,
    );
    assert.deepEqual(rows, [
      { name: "Lake Oil Nairobi", litres: 15_000, prevLitres: 0 },
      { name: "KPC Eldoret", litres: 8_000, prevLitres: 3_000 },
      { name: "Other", litres: 1_500, prevLitres: 0 },
    ]);
  });
});

describe("topDealers", () => {
  it("ranks dealers by litres this month and keeps the top n", () => {
    const orders = ["A", "B", "C", "D", "E", "F"].map((d, i) => order("kitale", d, (i + 1) * 1000));
    orders.push(order("kitale", "A", 10_000), order("kitale", "Z", 50_000, lastMonth));
    assert.deepEqual(topDealers(orders, now), [
      { name: "A", litres: 11_000 },
      { name: "F", litres: 6_000 },
      { name: "E", litres: 5_000 },
      { name: "D", litres: 4_000 },
      { name: "C", litres: 3_000 },
    ]);
  });
});

describe("goneQuiet", () => {
  it("lists dealers whose last order is more than 30 days old, oldest first, at most 8", () => {
    const ago = (d: number) => new Date(now.getTime() - d * DAY);
    const rows = goneQuiet(
      [
        { name: "Thirty", lastOrderAt: ago(30) },
        { name: "ThirtyOne", lastOrderAt: ago(31) },
        { name: "Sixty", lastOrderAt: ago(60) },
        { name: "Recent", lastOrderAt: ago(2) },
      ],
      now,
    );
    assert.deepEqual(rows, [
      { name: "Sixty", days: 60 },
      { name: "ThirtyOne", days: 31 },
    ]);
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `D${i}`, lastOrderAt: ago(40 + i) }));
    assert.equal(goneQuiet(many, now).length, 8);
  });
});
