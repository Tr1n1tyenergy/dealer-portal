import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStationSelection, type StationSelectionRow } from "./station-selection";

const VERECA = "VERECA ENTERPRISES LIMITED";
const TULLA = "TULLA NAGELLE ENERGY AND COURIOR SERVICES LIMITED";

const rows: StationSelectionRow[] = [
  { stationCode: "banana", stationName: "Banana", orgCode: "VERECA", orgName: VERECA, invitable: true },
  { stationCode: "nakuru", stationName: "Nakuru", orgCode: "VERECA", orgName: VERECA, invitable: true },
  { stationCode: "kiserian", stationName: "Kiserian", orgCode: "TULLA", orgName: TULLA, invitable: true },
  { stationCode: "mumias", stationName: "Mumias", orgCode: "MASAHA", orgName: "MASAHA FUEL POINT", invitable: true },
  { stationCode: "kambiti", stationName: "Kambiti", orgCode: "KAMBITI-DUMMY", orgName: "PLACEHOLDER", invitable: false },
];

describe("dealer invite station selection", () => {
  it("accepts two stations of the same company", () => {
    const result = checkStationSelection(rows, ["banana", "nakuru"]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.orgCode, "VERECA");
    assert.equal(result.orgName, VERECA);
    assert.deepEqual(result.rows.map((r) => r.stationCode), ["banana", "nakuru"]);
  });

  it("accepts a single station", () => {
    const result = checkStationSelection(rows, ["kiserian"]);
    assert.equal(result.ok, true);
  });

  it("treats a repeated station as one", () => {
    const result = checkStationSelection(rows, ["banana", "banana"]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.rows.map((r) => r.stationCode), ["banana"]);
  });

  it("rejects stations of different companies", () => {
    const result = checkStationSelection(rows, ["banana", "kiserian"]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 400);
    assert.equal(
      result.message,
      `Banana and Kiserian belong to separate dealer companies (${VERECA}, ${TULLA}) and can't be linked to one user.`
    );
  });

  it("rejects a mixed selection of three", () => {
    const result = checkStationSelection(rows, ["banana", "nakuru", "mumias"]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(
      result.message,
      `These stations belong to separate dealer companies (${VERECA}, MASAHA FUEL POINT) and can't be linked to one user.`
    );
  });

  it("rejects an empty selection", () => {
    const result = checkStationSelection(rows, []);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, "Select at least one station.");
  });

  it("rejects an unknown code", () => {
    const result = checkStationSelection(rows, ["banana", "nowhere"]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, "Unknown station code: nowhere.");
  });

  it("rejects a station without Odoo IDs", () => {
    const result = checkStationSelection(rows, ["kambiti"]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /not invitable yet/);
  });
});
