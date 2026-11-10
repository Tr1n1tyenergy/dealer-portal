import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Integration tests: need a PostgreSQL database whose name ends in `_test` (see .env.test.local, `npm run test:db`).
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(process.env.DATABASE_URL ?? "");

describe("uploads are kept in the database", { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" }, () => {
  const run = `sf${Date.now()}`;
  let support: typeof import("@/lib/support/storage");
  let rtt: typeof import("@/lib/stock-reporting/rtt-storage");
  let diskRoot = "";

  before(async () => {
    diskRoot = await mkdtemp(path.join(tmpdir(), "sf-"));
    process.env.SUPPORT_UPLOAD_DIR = diskRoot;
    process.env.RTT_UPLOAD_DIR = diskRoot;
    support = await import("@/lib/support/storage");
    rtt = await import("@/lib/stock-reporting/rtt-storage");
  });

  after(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.storedFile.deleteMany({ where: { key: { contains: run } } });
    await rm(diskRoot, { recursive: true, force: true });
  });

  it("a support attachment is stored, read back byte for byte, and deleted, without touching the disk", async () => {
    const buffer = Buffer.from("%PDF-1.4 support " + run);
    const { storageKey } = await support.storeSupportUpload(`t-${run}`, { buffer, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: buffer.length });
    assert.deepEqual(await support.readSupportUpload(storageKey), buffer);
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual(await readdir(diskRoot), [], "nothing written to the local disk");
    await support.deleteSupportUpload(storageKey);
    await assert.rejects(() => support.readSupportUpload(storageKey));
  });

  it("an RTT job card is stored and read back", async () => {
    const buffer = Buffer.from("%PDF-1.4 rtt " + run);
    const stored = await rtt.storeRttJobCard(`st-${run}`, `ev-${run}`, { buffer, fileName: "card.pdf", mimeType: "application/pdf", sizeBytes: buffer.length });
    assert.deepEqual(await rtt.readRttJobCard(stored.storageKey), buffer);
    await rtt.deleteRttJobCard(stored.storageKey);
    await assert.rejects(() => rtt.readRttJobCard(stored.storageKey));
  });

  it("a file saved on disk before this change still opens", async () => {
    const key = path.join(`old-${run}`, "legacy.pdf");
    await mkdir(path.join(diskRoot, `old-${run}`), { recursive: true });
    await writeFile(path.join(diskRoot, key), "legacy bytes");
    assert.equal((await support.readSupportUpload(key)).toString(), "legacy bytes");
  });
});
