import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOpenPfi } from "./pfi-access";

const ORG = "org-1";

describe("canOpenPfi", () => {
  it("lets Admins and Sales Person Executives open any PFI", () => {
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "SUPER_ADMIN", permissions: "[]" }, ORG), true);
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "SALES_PERSON_EXECUTIVE", permissions: "[]" }, ORG), true);
  });

  it("lets a dealer open their own organisation's PFI only", () => {
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_USER", dealerOrganizationId: ORG }, ORG), true);
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_ADMIN", dealerOrganizationId: "org-2" }, ORG), false);
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_ADMIN", dealerOrganizationId: null }, ORG), false);
  });

  it("refuses Staff Members and depot users", () => {
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "STANDARD_USER", permissions: "[]" }, ORG), false);
    assert.equal(canOpenPfi({ accountType: "DEPOT", role: "DEPOT_MANAGER" }, ORG), false);
  });

  it("follows a person's ticks: an SPE denied Orders can't open PFIs", () => {
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "SALES_PERSON_EXECUTIVE", permissions: '{"orders.view":"deny"}' }, ORG), false);
  });
});
