import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStationInviteRow,
  listInvitableStations,
  listStationInviteCatalog,
} from "./station-invite-catalog";

describe("station-invite-catalog", () => {
  it("lists stations with station name as primary identity", () => {
    const rows = listStationInviteCatalog();
    assert.ok(rows.length > 10);
    const kitanga = getStationInviteRow("kitanga");
    assert.ok(kitanga);
    assert.equal(kitanga.stationName, "Kitanga");
    assert.equal(kitanga.tradingName, "MEMISI SUPPLIERS LTD");
    assert.equal(kitanga.orgCode, "MEMISI");
  });

  it("marks Kitanga invitable when both External IDs exist", () => {
    const kitanga = getStationInviteRow("kitanga");
    assert.ok(kitanga);
    assert.ok(kitanga.odooPartnerExternalId?.startsWith("__export__.res_partner_"));
    assert.ok(kitanga.odooStationExternalId?.startsWith("__export__.account_analytic_account_"));
    assert.equal(kitanga.invitable, true);
  });

  it("excludes stations missing partner or station External ID from invitable list", () => {
    const invitable = listInvitableStations();
    assert.ok(invitable.every((r) => r.odooPartnerExternalId && r.odooStationExternalId));
    const dagoretti = getStationInviteRow("dagoretti");
    if (dagoretti) {
      assert.equal(dagoretti.invitable, false);
      assert.ok(!invitable.some((r) => r.stationCode === "dagoretti"));
    }
  });

  it("includes Banana with both External IDs", () => {
    const banana = getStationInviteRow("banana");
    assert.ok(banana);
    assert.equal(banana.invitable, true);
    assert.match(banana.odooPartnerExternalId!, /res_partner_5207/);
    assert.match(banana.odooStationExternalId!, /account_analytic_account_1_/);
  });
});
