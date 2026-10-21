import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOpenPfi } from "./pfi-access";

const ORG = "org-1";

describe("canOpenPfi", () => {
  it("lets Admins and Sales Person Executives open any PFI", () => {
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "SUPER_ADMIN" }, ORG), true);
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "SALES_PERSON_EXECUTIVE" }, ORG), true);
  });

  it("lets a dealer open their own organisation's PFI only", () => {
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_USER", dealerOrganizationId: ORG }, ORG), true);
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_ADMIN", dealerOrganizationId: "org-2" }, ORG), false);
    assert.equal(canOpenPfi({ accountType: "DEALER", role: "DEALER_ADMIN", dealerOrganizationId: null }, ORG), false);
  });

  it("refuses Staff Members and depot users", () => {
    assert.equal(canOpenPfi({ accountType: "INTERNAL", role: "STANDARD_USER" }, ORG), false);
    assert.equal(canOpenPfi({ accountType: "DEPOT", role: "DEPOT_MANAGER" }, ORG), false);
  });
});
