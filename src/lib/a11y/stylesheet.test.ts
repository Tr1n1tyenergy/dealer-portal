import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync("src/styles/accessibility.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("accessibility stylesheet", () => {
  it("scales the root text size", () => {
    assert.match(css, /html\[data-a11y-text="large"\][^{]*\{[^}]*calc\(var\(--tri-root-font[^)]*\)\s*\*\s*1\.15\)/);
    assert.match(css, /html\[data-a11y-text="xlarge"\][^{]*\{[^}]*calc\(var\(--tri-root-font[^)]*\)\s*\*\s*1\.3\)/);
  });

  it("stops motion on request and when the device asks", () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0\.01ms !important/);
    assert.match(css, /html\[data-a11y-motion="reduce"\][\s\S]*transition-duration: 0\.01ms !important/);
  });

  it("swaps to a readable font", () => {
    assert.match(css, /html\[data-a11y-font="readable"\][\s\S]*Verdana/);
  });

  it("defines the high-contrast colours and the existing muted variables", () => {
    for (const s of ["--tri-text-faint: #475569", "--tri-text-faint-green: #047857", "--tri-text-faint-gold: #8a6100"]) {
      assert.ok(css.includes(s), s);
    }
    // Muted variables scoped to light wrappers (dark-theme ones stay light-on-dark).
    for (const [scope, v] of [[".dl", "--tri-muted-soft"], [".tri-access", "--tri-muted-soft"], [".ro", "--ro-muted"], [".ru-multi", "--ru-multi-muted"]]) {
      assert.ok(css.includes(`html[data-a11y-contrast] ${scope}`), scope);
      assert.match(css, new RegExp(`${v}: #475569`), v);
    }
    assert.match(css, /outline: 3px solid #1e3a8a/);
  });

  it("is loaded globally, and the layout applies choices before paint", () => {
    assert.match(globals, /@import "\.\.\/styles\/accessibility\.css"/);
    assert.match(layout, /suppressHydrationWarning/);
    assert.match(layout, /A11Y_HEAD_SCRIPT/);
  });
});
