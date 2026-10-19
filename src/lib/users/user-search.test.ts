import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesUserQuery } from "./user-search";

const staff = { firstName: "Jane", lastName: "Doe", email: "jane@example.test", role: "STANDARD_USER", accountType: "INTERNAL", department: "Retail", organization: "Head Office" };
const spe = { ...staff, firstName: "Sam", role: "SALES_PERSON_EXECUTIVE" };

describe("matchesUserQuery", () => {
  it("finds users by the role name shown on screen", () => {
    assert.equal(matchesUserQuery(staff, "staff member"), true);
    assert.equal(matchesUserQuery(spe, "sales person"), true);
    assert.equal(matchesUserQuery(staff, "sales person"), false);
  });

  it("still finds users by name, email, role code and organization", () => {
    assert.equal(matchesUserQuery(staff, "jane"), true);
    assert.equal(matchesUserQuery(staff, "example.test"), true);
    assert.equal(matchesUserQuery(staff, "standard_user"), true);
    assert.equal(matchesUserQuery(staff, "head office"), true);
  });

  it("matches everyone on an empty query", () => {
    assert.equal(matchesUserQuery(staff, ""), true);
  });
});
