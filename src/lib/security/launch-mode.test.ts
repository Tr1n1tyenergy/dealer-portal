import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  DEALER_ORDERING_UNAVAILABLE,
  dealerCommercialOrdersBlockedReason,
  dealerOrderingNotice,
  getLaunchMode,
} from "./launch-mode";

const env = process.env as Record<string, string | undefined>;

const keys = [
  "TRI_LAUNCH_MODE",
  "TRI_ALLOW_MOCK_DEALER_ORDERS",
  "ODOO_MODE",
  "NODE_ENV",
] as const;

describe("launch mode dealer order gates", () => {
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) previous[key] = env[key];
  });

  afterEach(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });

  it("blocks dealers in staff_preview", () => {
    env.TRI_LAUNCH_MODE = "staff_preview";
    delete env.TRI_ALLOW_MOCK_DEALER_ORDERS;
    assert.equal(getLaunchMode(), "staff_preview");
    assert.match(dealerCommercialOrdersBlockedReason() ?? "", /staff-preview/);
  });

  it("blocks dealers in production mock mode", () => {
    env.NODE_ENV = "production";
    env.ODOO_MODE = "mock";
    delete env.TRI_LAUNCH_MODE;
    delete env.TRI_ALLOW_MOCK_DEALER_ORDERS;
    assert.match(dealerCommercialOrdersBlockedReason() ?? "", /mock mode/);
  });

  it("allows override with TRI_ALLOW_MOCK_DEALER_ORDERS=1", () => {
    env.NODE_ENV = "production";
    env.ODOO_MODE = "mock";
    env.TRI_ALLOW_MOCK_DEALER_ORDERS = "1";
    assert.equal(dealerCommercialOrdersBlockedReason(), null);
  });

  it("gives dealers a plain message, not the technical reason, when ordering is off", () => {
    env.TRI_LAUNCH_MODE = "staff_preview";
    delete env.TRI_ALLOW_MOCK_DEALER_ORDERS;
    assert.equal(dealerOrderingNotice(), DEALER_ORDERING_UNAVAILABLE);
    assert.equal(
      DEALER_ORDERING_UNAVAILABLE,
      "Online ordering isn't available yet. You can't place orders here at the moment. Please contact your Trinity account manager to order."
    );
    assert.doesNotMatch(DEALER_ORDERING_UNAVAILABLE, /staff-preview|mock|Odoo/i);
  });

  it("has no dealer notice when ordering is allowed", () => {
    env.NODE_ENV = "production";
    env.ODOO_MODE = "mock";
    env.TRI_ALLOW_MOCK_DEALER_ORDERS = "1";
    assert.equal(dealerOrderingNotice(), null);
  });
});
