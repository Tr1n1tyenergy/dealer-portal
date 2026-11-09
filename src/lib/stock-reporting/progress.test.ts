import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStageProgress, dashboardReportStatus, nextIncompleteStage } from "./progress";

const base = {
  status: "DRAFT" as const,
  pumpMetersCompletedAt: null as Date | null,
  tankDipsCompletedAt: null as Date | null,
  wetStockCompletedAt: null as Date | null,
  monetaryCompletedAt: null as Date | null,
};

describe("stock reporting progress", () => {
  it("starts on Pump Meters for a new draft", () => {
    assert.equal(nextIncompleteStage(base), "PUMP_METERS");
    assert.equal(dashboardReportStatus(base), "in_progress");
    const rows = buildStageProgress(base);
    assert.equal(rows[0].state, "current");
    assert.equal(rows[1].state, "pending");
  });

  it("advances to Tank Dips after Pump Meters is persisted", () => {
    const report = { ...base, pumpMetersCompletedAt: new Date() };
    assert.equal(nextIncompleteStage(report), "TANK_DIPS");
    const rows = buildStageProgress(report);
    assert.equal(rows[0].state, "done");
    assert.equal(rows[1].state, "current");
  });

  it("marks all stages done when closed", () => {
    const report = { ...base, status: "CLOSED" as const };
    assert.equal(dashboardReportStatus(report), "closed");
    assert.ok(buildStageProgress(report).every((r) => r.state === "done"));
  });

  it("treats missing report as not started", () => {
    assert.equal(dashboardReportStatus(null), "not_started");
    assert.equal(buildStageProgress(null)[0].state, "current");
  });
});
