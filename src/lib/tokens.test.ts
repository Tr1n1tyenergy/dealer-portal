import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { hashToken } from "./tokens";

describe("hashToken", () => {
  it("is the SHA-256 hex of the token", () => {
    assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

/** Every non-test .ts/.tsx file under these folders. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });
}

describe("login tokens are never stored or looked up in plain text", () => {
  it("hashes the token in every invite / reset token write and lookup", () => {
    const offenders: string[] = [];
    const call = /(invitationToken|passwordResetToken)\s*\.(create|findUnique|findFirst|findMany|update|updateMany|deleteMany)\(/g;
    for (const file of [...sourceFiles("src/app"), ...sourceFiles("src/lib")]) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(call)) {
        const end = text.indexOf("})", m.index!);
        const args = text.slice(m.index!, end === -1 ? undefined : end + 2);
        const usesToken = /\btoken\s*[:,}]/.test(args.replace(/\b\w+Token\b/g, ""));
        if (usesToken && !args.includes("hashToken(")) {
          offenders.push(`${file}:${text.slice(0, m.index).split("\n").length}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
