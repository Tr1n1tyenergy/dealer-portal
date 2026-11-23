import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "stored files: uploads live in the database, old disk files still open",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let files: typeof import("./stored-files");
    let legacy = "";
    const run = `sf${Date.now()}`;

    before(async () => {
      files = await import("./stored-files");
      legacy = await mkdtemp(path.join(tmpdir(), "legacy-uploads-"));
    });

    after(async () => {
      await rm(legacy, { recursive: true, force: true });
      const { prisma } = await import("@/lib/prisma");
      await prisma.storedFile.deleteMany({ where: { key: { startsWith: run } } });
    });

    it("keeps a 4.5 MB file byte for byte", async () => {
      const data = randomBytes(4.5 * 1024 * 1024);
      await files.putStoredFile(`${run}/big.pdf`, data);
      assert.ok(data.equals(await files.getStoredFile(`${run}/big.pdf`, legacy)));
    });

    it("still reads a file saved on disk before uploads moved to the database", async () => {
      await mkdir(path.join(legacy, run), { recursive: true });
      await writeFile(path.join(legacy, run, "old.png"), Buffer.from("old bytes"));
      assert.equal((await files.getStoredFile(`${run}/old.png`, legacy)).toString(), "old bytes");
    });

    it("refuses a key that tries to leave the old folder", async () => {
      await assert.rejects(() => files.getStoredFile("../outside", legacy), /Invalid storage key/);
    });

    it("fails for a file that exists nowhere", async () => {
      await assert.rejects(() => files.getStoredFile(`${run}/missing.pdf`, legacy));
    });

    it("refuses to overwrite an existing key", async () => {
      await files.putStoredFile(`${run}/once.pdf`, Buffer.from("first"));
      await assert.rejects(() => files.putStoredFile(`${run}/once.pdf`, Buffer.from("second")));
      assert.equal((await files.getStoredFile(`${run}/once.pdf`, legacy)).toString(), "first");
    });

    it("forgets a deleted file", async () => {
      await files.putStoredFile(`${run}/gone.pdf`, Buffer.from("x"));
      await files.deleteStoredFile(`${run}/gone.pdf`);
      await assert.rejects(() => files.getStoredFile(`${run}/gone.pdf`, legacy));
    });
  }
);
