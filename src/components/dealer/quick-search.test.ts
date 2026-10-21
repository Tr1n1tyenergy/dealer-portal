import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quickSearchTarget, shortcutHint } from "./quick-search";

function stubDocument(found: Record<string, string>) {
  return {
    querySelector: (selector: string) => (found[selector] ? ({ id: found[selector] } as unknown as Element) : null),
  } as Pick<Document, "querySelector">;
}

describe("quickSearchTarget", () => {
  const page = '[data-quick-search="page"]';
  const top = '[data-quick-search="top"]';

  it("prefers the page's own search (the order page's Find another order)", () => {
    assert.deepEqual(quickSearchTarget(stubDocument({ [page]: "page", [top]: "top" })), { id: "page" });
  });

  it("falls back to the top-bar search", () => {
    assert.deepEqual(quickSearchTarget(stubDocument({ [top]: "top" })), { id: "top" });
  });

  it("finds nothing when neither search is on the page", () => {
    assert.equal(quickSearchTarget(stubDocument({})), null);
  });
});

describe("shortcutHint", () => {
  it("shows ⌘K on Apple devices and Ctrl K everywhere else", () => {
    assert.equal(shortcutHint("MacIntel"), "⌘K");
    assert.equal(shortcutHint("iPhone"), "⌘K");
    assert.equal(shortcutHint("Win32"), "Ctrl K");
    assert.equal(shortcutHint("Linux x86_64"), "Ctrl K");
    assert.equal(shortcutHint(""), "Ctrl K");
  });
});
