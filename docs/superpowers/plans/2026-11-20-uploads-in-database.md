# Uploads in the Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Support attachments and RTT job cards are stored in Postgres, not on the server's disk.
**Architecture:** One `StoredFile` table and a 3-function helper. The two storage modules call the helper and keep their public API.
**Tech Stack:** Prisma/Postgres, node:test + tsx.
**Spec:** `docs/superpowers/specs/2026-11-20-uploads-in-database-design.md`

## Global Constraints
- The storage-key format and the exported function names stay the same.
- Validation is unchanged.
- No Co-Authored-By trailer.
- Run `npm test` + `npm run test:db` before done.

## Review Focus
1. **A key that tries to escape the old folder through the disk fallback** (`../x`). It must be refused. (Task 1 test.)
2. **The same file stored twice under the same key** must give a clear error, not a silent overwrite. Keys are random, so this is unlikely.
3. **A file that is neither in the database nor on disk.** Reading it must throw, so the routes return their existing error or 404. (Task 1 test.)
4. **A 4.5 MB file** goes in and comes back byte for byte. (Task 1 test.)
5. **The download routes still send the right bytes and type.** (Task 3 browser check.)

### Task 1: StoredFile table and helper
**Files:**
- Modify `prisma/schema.prisma`.
- Create `prisma/migrations/20261120120000_stored_files/migration.sql`.
- Create `src/lib/files/stored-files.ts` and `src/lib/files/stored-files.db.test.ts` (add it to "test:db").

**Produces:** `putStoredFile(key: string, data: Buffer): Promise<void>`, `getStoredFile(key: string, legacyRoot: string): Promise<Buffer>`, `deleteStoredFile(key: string): Promise<void>`.

- [ ] **Write the DB test** (a `*_test` guard):
  - a 4.5 MB random buffer goes in and comes back equal;
  - an unknown key with an empty legacy dir rejects;
  - a file written only to a temp legacy dir is still read;
  - the key `../outside` rejects with "Invalid storage key.";
  - after a delete, the read rejects.
- [ ] **Run it.** Expected: FAIL (module missing).
- [ ] **Add the model and migration.** Apply them to tri_test with `prisma db push`. Implement the helper.
- [ ] **Run the test.** Expected: PASS. Then commit.

### Task 2: Switch both storage modules
**Files:** `src/lib/support/storage.ts`, `src/lib/stock-reporting/rtt-storage.ts`.
- [ ] **store:** `putStoredFile(storageKey, buffer)`. Drop `mkdir` and `writeFile`.
- [ ] **read:** `getStoredFile(storageKey, uploadRoot())`.
- [ ] **delete:** `deleteStoredFile(...).catch(() => undefined)`.
- [ ] **Add a DB test** (`src/lib/support/storage.db.test.ts`):
  - `storeSupportUpload` then `readSupportUpload` gives the same bytes;
  - nothing is created under `SUPPORT_UPLOAD_DIR`, which points at an empty temp dir.

  Same test for RTT. Watch it fail before the switch.
- [ ] **Run** `tsc`, `npm test` and `npm run test:db`, then commit.

### Task 3: Browser check
- [ ] **Run** `migrate deploy` on tri_stress, then build and start on :3996.
- [ ] **Check:**
  - A dealer creates a support ticket with a PNG and a PDF.
  - Staff open the ticket and download both, getting the same bytes and the right content type.
  - `.data/` gets no new files.
- [ ] **Do an RTT job card** upload and download through the UI if reachable. Otherwise the DB test covers it, and I'll say so.
- [ ] **Final review** by a fresh reviewer. Then write the PR text to `D:\Downloads\pr-uploads-in-database.md`.
