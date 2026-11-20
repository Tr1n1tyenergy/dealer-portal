import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// Integration tests: these need a real PostgreSQL database whose name ends in `_test`
// (see .env.test.local and `npm run test:db`). They never run against tri_dev or Neon.
const databaseUrl = process.env.DATABASE_URL ?? "";
const usingTestDatabase = /\/[a-z0-9_]+_test(\?|$)/i.test(databaseUrl);

describe(
  "support attachments and RTT job cards are kept in the database, never on the server's disk",
  { skip: usingTestDatabase ? false : "DATABASE_URL must point at a *_test database" },
  () => {
    let disk = "";
    const keys: string[] = [];
    const saved = { support: process.env.SUPPORT_UPLOAD_DIR, rtt: process.env.RTT_UPLOAD_DIR };

    before(async () => {
      disk = await mkdtemp(path.join(tmpdir(), "uploads-disk-"));
      process.env.SUPPORT_UPLOAD_DIR = path.join(disk, "support");
      process.env.RTT_UPLOAD_DIR = path.join(disk, "rtt");
    });

    after(async () => {
      const { prisma } = await import("@/lib/prisma");
      await prisma.storedFile.deleteMany({ where: { key: { in: keys } } });
      await rm(disk, { recursive: true, force: true });
      process.env.SUPPORT_UPLOAD_DIR = saved.support;
      process.env.RTT_UPLOAD_DIR = saved.rtt;
    });

    it("stores, reads back and deletes a support attachment", async () => {
      const storage = await import("@/lib/support/storage");
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("picture")]);
      const { storageKey } = await storage.storeSupportUpload(`t-${Date.now()}`, {
        buffer: png,
        fileName: "photo.png",
        mimeType: "image/png",
        sizeBytes: png.length,
      });
      keys.push(storageKey);
      assert.ok(png.equals(await storage.readSupportUpload(storageKey)));
      await storage.deleteSupportUpload(storageKey);
      await assert.rejects(() => storage.readSupportUpload(storageKey));
    });

    it("stores and reads back an RTT job card", async () => {
      const rtt = await import("@/lib/stock-reporting/rtt-storage");
      const pdf = Buffer.from("%PDF-1.4 job card");
      const { storageKey } = await rtt.storeRttJobCard(`s-${Date.now()}`, "e1", {
        buffer: pdf,
        fileName: "job-card.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
      });
      keys.push(storageKey);
      assert.ok(pdf.equals(await rtt.readRttJobCard(storageKey)));
    });

    it("wrote nothing to the server's disk", async () => {
      const entries = await readdir(disk, { recursive: true });
      assert.deepEqual(entries, []);
    });
  }
);
