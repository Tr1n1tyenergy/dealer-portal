import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStockReportReference,
  stationCodeForReference,
  wetResolutionLabel,
} from "./reference";

describe("buildStockReportReference", () => {
  it("matches SSR-CODE-YYYY-MM-DD", () => {
    assert.equal(stationCodeForReference("kitale"), "KITALE");
    assert.equal(
      buildStockReportReference({
        stationCode: "kitale",
        reportingDate: new Date(Date.UTC(2026, 10, 6)),
      }),
      "SSR-KITALE-2026-11-06"
    );
  });
});

describe("wetResolutionLabel", () => {
  it("maps loss and balanced outcomes", () => {
    assert.equal(wetResolutionLabel("RECORD_LOSS", "VARIANCE_RECORDED"), "Recorded as Loss");
    assert.equal(wetResolutionLabel("BALANCED", "BALANCED"), "Balanced");
  });
});
