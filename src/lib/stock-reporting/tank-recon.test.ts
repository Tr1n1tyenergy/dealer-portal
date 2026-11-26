import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcilePumpsToTanks, rollupTankLines, tankLinesBalanced } from "./tank-recon";

describe("reconcilePumpsToTanks", () => {
  it("adds every pump on a tank and compares that total with the one dip", () => {
    const lines = reconcilePumpsToTanks({
      tanks: [
        { tankKey: "PMS-1", label: "PMS Tank 1", product: "PMS" },
        { tankKey: "AGO-1", label: "AGO Tank 1", product: "AGO" },
        { tankKey: "AGO-2", label: "AGO Tank 2", product: "AGO" },
      ],
      pumps: [
        { tankKey: "PMS-1" },
        { tankKey: "PMS-1" },
        { tankKey: "PMS-1" },
        { tankKey: "PMS-1" },
        { tankKey: "AGO-1" },
        { tankKey: "AGO-1" },
        { tankKey: "AGO-2" },
        { tankKey: "AGO-2" },
      ],
      meterSales: [
        { tankKey: "PMS-1", sales: 100 },
        { tankKey: "PMS-1", sales: 80 },
        { tankKey: "PMS-1", sales: 70 },
        { tankKey: "PMS-1", sales: 50 },
        { tankKey: "AGO-1", sales: 40 },
        { tankKey: "AGO-1", sales: 30 },
        { tankKey: "AGO-2", sales: 20 },
        { tankKey: "AGO-2", sales: 25 },
      ],
      tankSales: [
        { tankKey: "PMS-1", sales: 300 },
        { tankKey: "AGO-1", sales: 70 },
        { tankKey: "AGO-2", sales: 40 },
      ],
    });

    const pms = lines.find((line) => line.tankKey === "PMS-1");
    assert.equal(pms?.pumpCount, 4);
    assert.equal(pms?.meterSales, 300);
    assert.equal(pms?.tankSales, 300);
    assert.equal(pms?.variance, 0);

    const ago1 = lines.find((line) => line.tankKey === "AGO-1");
    assert.equal(ago1?.pumpCount, 2);
    assert.equal(ago1?.variance, 0);

    const ago2 = lines.find((line) => line.tankKey === "AGO-2");
    assert.equal(ago2?.meterSales, 45);
    assert.equal(ago2?.variance, 5);
    assert.equal(tankLinesBalanced(lines), false);

    const rollup = rollupTankLines(lines);
    assert.equal(rollup.meterPms, 300);
    assert.equal(rollup.meterAgo, 115);
    assert.equal(rollup.tankAgo, 110);
  });
});
