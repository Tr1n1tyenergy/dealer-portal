import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/** Every file under src that names an image in /public. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("images referenced in the code", () => {
  it("all exist in /public, so no page shows a broken image", () => {
    const missing = sourceFiles("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/["'(](\/assets2\/[^"')\s]+\.(?:jpe?g|png|svg|webp))/g)]
        .map((m) => m[1])
        .filter((src) => !existsSync(join("public", src)))
        .map((src) => `${file}: ${src}`),
    );
    assert.deepEqual(missing, []);
  });
});
