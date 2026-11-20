# Uploads in the database (to-do 2.2)

**Status:** approved by Adrian, 20 Nov 2026 · **Size:** small change

## Why
Support ticket attachments and RTT job cards are written to `.data/` on the server's disk. Vercel functions have no lasting disk, so in production these uploads fail or vanish.

## Approaches
- **Database table (picked):** this was built before on `feat/portal-redesign` (3e22e0d) and never merged. It works today with no new accounts.
- **Vercel Blob or S3:** both need a token or account. Nobody here can reach the Vercel project (to-do 2.8). Revisit if file volume grows.

## Design
- **New `StoredFile` table:** `key` (TEXT, primary key), `data` (BYTEA), `createdAt`. Migration `20261120120000_stored_files`.
- **New `src/lib/files/stored-files.ts`:**
  - `putStoredFile(key, data)`
  - `getStoredFile(key, legacyRoot)`: tries the database first. If the file isn't there, it reads the old disk folder, keeping the old path-escape check.
  - `deleteStoredFile(key)`
- **`src/lib/support/storage.ts` and `src/lib/stock-reporting/rtt-storage.ts`** keep their exported functions and storage-key format. They only swap disk writes for these calls.
- **Unchanged:** validation (size, file-type sniffing, safe names). Deletes stay best-effort.

## Not doing
- No moving of files that already exist on disk. Production never kept any.
- No size or quota changes.
