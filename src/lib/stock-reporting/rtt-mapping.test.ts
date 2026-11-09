import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { linkedTankForPump } from "./rtt";

describe("linkedTankForPump", () => {
  const tanks = [
    { id: "t1", tankKey: "PMS-1", label: "PMS Tank 1", product: "PMS" as const, sortOrder: 0 },
    { id: "t2", tankKey: "PMS-2", label: "PMS Tank 2", product: "PMS" as const, sortOrder: 1 },
    { id: "t3", tankKey: "AGO-1", label: "AGO Tank 1", product: "AGO" as const, sortOrder: 2 },
    { id: "t4", tankKey: "AGO-2", label: "AGO Tank 2", product: "AGO" as const, sortOrder: 3 },
  ];

  it("maps PMS 1 → PMS Tank 1", () => {
    const tank = linkedTankForPump({ pumpKey: "PMS-1", product: "PMS" }, tanks);
    assert.equal(tank?.id, "t1");
    assert.equal(tank?.label, "PMS Tank 1");
  });

  it("maps AGO 2 → AGO Tank 2", () => {
    const tank = linkedTankForPump({ pumpKey: "AGO-2", product: "AGO" }, tanks);
    assert.equal(tank?.id, "t4");
  });

  it("returns null when no matching tank exists", () => {
    const tank = linkedTankForPump({ pumpKey: "PMS-9", product: "PMS" }, tanks);
    assert.equal(tank, null);
  });
});
