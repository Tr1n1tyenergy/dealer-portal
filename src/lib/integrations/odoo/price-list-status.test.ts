import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceListStatus } from "./price-list-status";

// Kenya time is UTC+3 all year, so midnight in Nairobi is 21:00 UTC the day before.
const kenya = (iso: string) => new Date(`${iso}+03:00`);

describe("priceListStatus (list valid to 14 Nov 2026)", () => {
  it("is current until the end of 11 Nov, Kenya time", () => {
    const status = priceListStatus(kenya("2026-11-11T23:59:59"));
    assert.equal(status.state, "current");
    assert.equal(status.message, null);
  });

  it("is ending soon from 12 Nov 00:00 to 14 Nov 23:59, Kenya time", () => {
    for (const at of ["2026-11-12T00:00:00", "2026-11-14T23:59:59"]) {
      const status = priceListStatus(kenya(at));
      assert.equal(status.state, "ending", at);
      assert.equal(
        status.message,
        "The EPRA price list ends on 14 Nov 2026. Update it when EPRA publishes the new list on the 15th.",
      );
    }
  });

  it("is expired from 15 Nov 00:00, Kenya time", () => {
    for (const at of ["2026-11-15T00:00:00", "2026-12-20T09:00:00"]) {
      const status = priceListStatus(kenya(at));
      assert.equal(status.state, "expired", at);
      assert.equal(
        status.message,
        "The EPRA price list expired on 14 Nov 2026. New quotations still use these prices until the list is updated.",
      );
    }
  });

  it("follows the end date stored in the price table", () => {
    assert.equal(priceListStatus(kenya("2026-12-13T00:00:00"), "2026-12-14").state, "ending");
    assert.equal(priceListStatus(kenya("2026-11-20T00:00:00"), "2026-12-14").state, "current");
  });
});
