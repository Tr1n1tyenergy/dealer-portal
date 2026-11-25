import { test } from "node:test";
import assert from "node:assert/strict";
import { fitCount } from "./fit";

test("every tab shows when they all fit, with no room kept for More", () => {
  assert.equal(fitCount([80, 80, 80], 240, 70), 3);
});

test("when they don't all fit, room is kept for the More button", () => {
  // 80+80+70 = 230 fits in 239; a third tab would need 310
  assert.equal(fitCount([80, 80, 80], 239, 70), 2);
});

test("a long last tab (Stock Sale Reporting) moves into More instead of being cut off", () => {
  assert.equal(fitCount([60, 70, 80, 90, 70, 60, 70, 170], 600, 70), 7);
});

test("never negative: a very narrow header puts everything in More", () => {
  assert.equal(fitCount([80, 80], 50, 70), 0);
});
