import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCapacityDisplay,
  resolveCompartmentCapacities,
} from "./truck-compartments";

describe("resolveCompartmentCapacities", () => {
  it("auto-calculates the final compartment to match capacity", () => {
    const result = resolveCompartmentCapacities(10_000, 4, [2000, 3000, 2000]);
    assert.equal(result.valid, true);
    assert.deepEqual(result.capacities, [2000, 3000, 2000, 3000]);
    assert.equal(result.lastLitres, 3000);
  });

  it("recalculates when an earlier compartment changes", () => {
    const result = resolveCompartmentCapacities(10_000, 4, [2500, 3000, 2000]);
    assert.equal(result.valid, true);
    assert.equal(result.capacities[3], 2500);
  });

  it("blocks allocations that exceed capacity", () => {
    const result = resolveCompartmentCapacities(10_000, 4, [4000, 4000, 3000]);
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /exceeds/i);
  });

  it("blocks a zero final compartment", () => {
    const result = resolveCompartmentCapacities(10_000, 3, [5000, 5000]);
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /zero/i);
  });

  it("supports a single compartment equal to total capacity", () => {
    const result = resolveCompartmentCapacities(10_000, 1, []);
    assert.equal(result.valid, true);
    assert.deepEqual(result.capacities, [10_000]);
  });
});

describe("formatCapacityDisplay", () => {
  it("shows litres and cubic metres", () => {
    assert.equal(formatCapacityDisplay(10_000), "10,000 L (10 m³)");
    assert.equal(formatCapacityDisplay(2500), "2,500 L (2.5 m³)");
  });
});
