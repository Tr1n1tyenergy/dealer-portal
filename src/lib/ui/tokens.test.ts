import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync("src/app/globals.css", "utf8");

describe("design tokens", () => {
  it("globals.css carries the brand tokens and the Century Gothic stack", () => {
    for (const token of [
      "--tri-blue: #3853a4",
      "--tri-teal: #2cc0d2",
      "--tri-yellow: #ffca06",
      "--tri-ink: #18213a",
      "--tri-soft: #64708a",
      "--tri-ground: #f9fafb",
      "--tri-surface: #ffffff",
    ]) {
      assert.ok(css.includes(token), token);
    }
    assert.ok(css.includes('"Century Gothic", "TeX Gyre Adventor", sans-serif'), "font stack");
    assert.ok(!css.includes('"Inter"'), "no Inter");
  });

  it("bundles TeX Gyre Adventor regular and bold, and the files exist", () => {
    const faces = [...css.matchAll(/@font-face\s*{[^}]*url\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.equal(faces.length, 2);
    for (const file of faces) assert.ok(existsSync(join("public", file)), file);
  });
});
