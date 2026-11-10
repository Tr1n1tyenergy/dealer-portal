import { test } from "node:test";
import assert from "node:assert/strict";
import { throttle } from "./throttle";

test("a call within the window is dropped; after it, it fires again", () => {
  let now = 0;
  let calls = 0;
  const run = throttle(() => calls++, 5000, () => now);
  run();
  now = 4999;
  run();
  assert.equal(calls, 1);
  now = 5000;
  run();
  assert.equal(calls, 2);
});
