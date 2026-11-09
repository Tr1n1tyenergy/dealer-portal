import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rowsToCsv,
  rowsToSpreadsheetMl,
  sanitizeSpreadsheetText,
  sumNullable,
  type ReportRecordExportRow,
} from "./records-export";

const sample: ReportRecordExportRow = {
  reportReference: "SSR-KIT-2026-11-09",
  reportingDate: "09 Nov 2026",
  station: "Kitanga",
  pumps: 4,
  tanks: 4,
  meterSalesLitres: 3900,
  tankSalesLitres: 3880,
  stockVarianceLitres: 20,
  expectedRevenueKes: 3_900_000,
  collectionsKes: 3_900_000,
  monetaryDifferenceKes: 0,
  status: "Closed",
  createdAt: "2026-11-09T12:00:00.000Z",
  updatedAt: "2026-11-09T18:00:00.000Z",
  submittedAt: "2026-11-09T18:00:00.000Z",
};

describe("records export helpers", () => {
  it("neutralizes spreadsheet formula injection", () => {
    assert.equal(sanitizeSpreadsheetText("=CMD()"), "'=CMD()");
    assert.equal(sanitizeSpreadsheetText("Normal"), "Normal");
  });

  it("sums nullable litre totals without inventing zeros for empty pairs", () => {
    assert.equal(sumNullable(null, null), null);
    assert.equal(sumNullable(10, null), 10);
    assert.equal(sumNullable(10, 5), 15);
  });

  it("builds CSV with header and BOM", () => {
    const csv = rowsToCsv([sample]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes("Report Reference"));
    assert.ok(csv.includes("SSR-KIT-2026-11-09"));
    assert.ok(csv.includes("3900000"));
  });

  it("builds SpreadsheetML workbook markup", () => {
    const xml = rowsToSpreadsheetMl([
      {
        ...sample,
        status: "Draft",
        meterSalesLitres: null,
        submittedAt: "",
        reportReference: "",
      },
    ]);
    assert.ok(xml.includes("Excel.Sheet"));
    assert.ok(xml.includes("Report Records"));
    assert.ok(xml.includes("Draft"));
  });
});
