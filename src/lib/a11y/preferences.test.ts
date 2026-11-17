import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  A11Y_DEFAULTS,
  A11Y_HEAD_SCRIPT,
  A11Y_STORAGE_KEY,
  applyPrefs,
  parsePrefs,
  prefsAttributes,
  readPrefs,
  writePrefs,
  type A11yPrefs,
} from "./preferences";

const ALL_ON: A11yPrefs = { text: "xlarge", contrast: true, motion: true, font: true };

function fakeRoot(initial: Record<string, string> = {}) {
  const attrs = new Map(Object.entries(initial));
  return {
    attrs,
    setAttribute: (n: string, v: string) => void attrs.set(n, v),
    removeAttribute: (n: string) => void attrs.delete(n),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("parsePrefs", () => {
  it("falls back to defaults for missing or broken values", () => {
    for (const raw of [null, undefined, "", "not json", "[]", "null", '{"text":"huge"}']) {
      assert.deepEqual(parsePrefs(raw), A11Y_DEFAULTS, String(raw));
    }
  });

  it("keeps the valid fields of a partial object", () => {
    assert.deepEqual(parsePrefs('{"contrast":true}'), { ...A11Y_DEFAULTS, contrast: true });
    assert.deepEqual(parsePrefs('{"text":"large","font":"yes"}'), { ...A11Y_DEFAULTS, text: "large" });
  });
});

describe("prefsAttributes / applyPrefs", () => {
  it("writes no attribute for the defaults", () => {
    assert.deepEqual(prefsAttributes(A11Y_DEFAULTS), {});
  });

  it("writes exactly the four attributes when everything is on", () => {
    assert.deepEqual(prefsAttributes(ALL_ON), {
      "data-a11y-text": "xlarge",
      "data-a11y-contrast": "",
      "data-a11y-motion": "reduce",
      "data-a11y-font": "readable",
    });
  });

  it("removes attributes that are no longer set", () => {
    const root = fakeRoot({ "data-a11y-contrast": "", "data-a11y-text": "large", lang: "en" });
    applyPrefs(root, { ...A11Y_DEFAULTS, motion: true });
    assert.deepEqual(Object.fromEntries(root.attrs), { lang: "en", "data-a11y-motion": "reduce" });
  });
});

describe("readPrefs / writePrefs", () => {
  it("round-trips through storage under the tri-a11y key", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    writePrefs(ALL_ON, storage);
    assert.ok(store.has(A11Y_STORAGE_KEY));
    assert.deepEqual(readPrefs(storage), ALL_ON);
  });

  it("survives storage that throws", () => {
    assert.deepEqual(readPrefs(throwing), A11Y_DEFAULTS);
    assert.doesNotThrow(() => writePrefs(ALL_ON, throwing));
  });
});

describe("A11Y_HEAD_SCRIPT", () => {
  const run = (getItem: () => string | null) => {
    const root = fakeRoot();
    new Function("document", "localStorage", A11Y_HEAD_SCRIPT)({ documentElement: root }, { getItem });
    return Object.fromEntries(root.attrs);
  };

  it("applies stored choices before paint", () => {
    assert.deepEqual(run(() => '{"text":"large"}'), { "data-a11y-text": "large" });
    assert.deepEqual(run(() => JSON.stringify(ALL_ON)), prefsAttributes(ALL_ON));
  });

  it("writes nothing for unsafe values or blocked storage", () => {
    assert.deepEqual(run(() => '{"text":"<x onerror=1>"}'), {});
    assert.deepEqual(run(() => '{"contrast":"yes"}'), {});
    assert.doesNotThrow(() =>
      run(() => {
        throw new Error("blocked");
      }),
    );
  });
});
