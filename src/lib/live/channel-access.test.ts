import { test } from "node:test";
import assert from "node:assert/strict";
import { liveChannelAccess } from "./channel-access";

const staff = (permissions: Record<string, string> = {}, role = "STANDARD_USER") =>
  ({ accountType: "INTERNAL", role, permissions: JSON.stringify(permissions), dealerOrganizationId: null }) as const;
const dealer = (org: string) => ({ accountType: "DEALER", role: "DEALER", permissions: "{}", dealerOrganizationId: org }) as const;

test("staff channel: only staff who may view Orders", () => {
  assert.equal(liveChannelAccess(staff({ "orders.view": "allow" }), "private-orders-staff"), "allow");
  assert.equal(liveChannelAccess(staff({}, "SALES_PERSON_EXECUTIVE"), "private-orders-staff"), "allow");
  assert.equal(liveChannelAccess(staff(), "private-orders-staff"), "deny");
  assert.equal(liveChannelAccess(dealer("org1"), "private-orders-staff"), "deny");
});

test("dealer channel: only that organisation's dealers", () => {
  assert.equal(liveChannelAccess(dealer("org1"), "private-orders-dealer-org1"), "allow");
  assert.equal(liveChannelAccess(dealer("org1"), "private-orders-dealer-org2"), "deny");
  assert.equal(liveChannelAccess(staff({ "orders.view": "allow" }), "private-orders-dealer-org1"), "deny");
  assert.equal(liveChannelAccess({ ...dealer(""), dealerOrganizationId: null }, "private-orders-dealer-"), "deny");
});

test("conversations are checked as before; anything else is refused", () => {
  assert.equal(liveChannelAccess(dealer("org1"), "private-conversation-abc"), "conversation");
  assert.equal(liveChannelAccess(staff(), "private-anything"), "deny");
  assert.equal(liveChannelAccess(staff(), "presence-orders-staff"), "deny");
});
