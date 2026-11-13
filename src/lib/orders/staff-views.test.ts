import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffOrderFilters, reportingPeriod, paymentSummary, stepCompletionTimes } from "./staff-views";

// 11 Nov 2026, 09:00 Nairobi (06:00 UTC)
const NOW = new Date("2026-11-11T06:00:00Z");

describe("staff order filters", () => {
  it("parses defaults: all orders, page 1, no period, nothing selected", () => {
    const f = staffOrderFilters({}, NOW);
    assert.deepEqual(
      [f.stage, f.q, f.page, f.stationId, f.dealerId, f.period, f.range, f.sel],
      ["all", "", 1, null, null, "all", null, null]
    );
  });

  it("keeps valid values and drops junk", () => {
    const f = staffOrderFilters(
      { stage: "depot", q: "  DO-2026 ", page: "3", station: "ck123", dealer: "ck456", sel: "ck789" },
      NOW
    );
    assert.deepEqual(
      [f.stage, f.q, f.page, f.stationId, f.dealerId, f.sel],
      ["depot", "DO-2026", 3, "ck123", "ck456", "ck789"]
    );
    assert.equal(staffOrderFilters({ page: "0" }, NOW).page, 1);
    assert.equal(staffOrderFilters({ page: "junk" }, NOW).page, 1);
  });
});

describe("reporting period", () => {
  it("today covers the Nairobi day", () => {
    const r = reportingPeriod("today", null, null, NOW)!;
    assert.equal(r.gte.toISOString(), "2026-11-10T21:00:00.000Z"); // 00:00 Nairobi 11 Nov
    assert.equal(r.lt.toISOString(), "2026-11-11T21:00:00.000Z");
  });

  it("last 7 days ends tomorrow midnight and starts 7 days back", () => {
    const r = reportingPeriod("7d", null, null, NOW)!;
    assert.equal(r.gte.toISOString(), "2026-11-04T21:00:00.000Z");
    assert.equal(r.lt.toISOString(), "2026-11-11T21:00:00.000Z");
  });

  it("this month and previous month use Nairobi month bounds", () => {
    const m = reportingPeriod("month", null, null, NOW)!;
    assert.equal(m.gte.toISOString(), "2026-10-31T21:00:00.000Z"); // 1 Nov 00:00 Nairobi
    const p = reportingPeriod("prev-month", null, null, NOW)!;
    assert.equal(p.gte.toISOString(), "2026-09-30T21:00:00.000Z");
    assert.equal(p.lt.toISOString(), "2026-10-31T21:00:00.000Z");
  });

  it("custom range is inclusive of the end day; bad input means no filter", () => {
    const r = reportingPeriod("custom", "2026-11-01", "2026-11-09", NOW)!;
    assert.equal(r.gte.toISOString(), "2026-10-31T21:00:00.000Z");
    assert.equal(r.lt.toISOString(), "2026-11-09T21:00:00.000Z");
    assert.equal(reportingPeriod("custom", "nope", "2026-11-09", NOW), null);
    assert.equal(reportingPeriod("all", null, null, NOW), null);
  });
});

describe("payment summary", () => {
  it("counts only confirmed payments and nets them off the PFI total", () => {
    const s = paymentSummary("1227312.00", [
      { amount: "500000.00", status: "CONFIRMED" },
      { amount: "100000.00", status: "SUBMITTED" },
      { amount: "50000.00", status: "REJECTED" },
    ]);
    assert.deepEqual([s.paid, s.due], ["500000.00", "727312.00"]);
  });

  it("with nothing confirmed everything is due; never negative", () => {
    assert.deepEqual(paymentSummary("1227312.00", []), { paid: "0.00", due: "1227312.00" });
    const over = paymentSummary("100.00", [{ amount: "150.00", status: "CONFIRMED" }]);
    assert.deepEqual([over.paid, over.due], ["150.00", "0.00"]);
  });

  it("without a PFI total there is nothing due", () => {
    assert.deepEqual(paymentSummary(null, [{ amount: "5.00", status: "CONFIRMED" }]), { paid: "5.00", due: null });
  });
});

describe("step completion times", () => {
  it("a step is complete when the order first moved past it", () => {
    const t = (iso: string) => new Date(iso);
    const times = stepCompletionTimes([
      { toStatus: "SUBMITTED", createdAt: t("2026-11-06T15:29:00Z") },
      { toStatus: "QUOTATION_CREATING", createdAt: t("2026-11-06T15:30:00Z") },
      { toStatus: "PFI_ISSUED", createdAt: t("2026-11-06T15:35:00Z") },
      { toStatus: "AWAITING_PAYMENT", createdAt: t("2026-11-06T15:36:00Z") },
    ]);
    assert.equal(times[0]?.toISOString(), "2026-11-06T15:29:00.000Z"); // submitted done
    assert.equal(times[1]?.toISOString(), "2026-11-06T15:35:00.000Z"); // quotation & PFI done
    assert.equal(times[2], null); // payment still open
    assert.deepEqual(times.slice(3), [null, null, null]);
  });

  it("a delivered order completes every step, and junk history is ignored", () => {
    const times = stepCompletionTimes([
      { toStatus: "SUBMITTED", createdAt: new Date("2026-11-01T08:00:00Z") },
      { toStatus: "CANCELLED", createdAt: new Date("2026-11-01T09:00:00Z") }, // stopped rows don't advance
      { toStatus: "DELIVERED", createdAt: new Date("2026-11-03T10:00:00Z") },
    ]);
    assert.equal(times[5]?.toISOString(), "2026-11-03T10:00:00.000Z");
    assert.equal(times[2]?.toISOString(), "2026-11-03T10:00:00.000Z");
  });
});
