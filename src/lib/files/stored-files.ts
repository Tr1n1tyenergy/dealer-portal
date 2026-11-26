import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/** Saves an upload's bytes. Keys are unique: a second save under the same key fails rather than overwriting. */
export async function putStoredFile(key: string, data: Buffer): Promise<void> {
  await prisma.storedFile.create({ data: { key, data: new Uint8Array(data) } });
}

/** The file's bytes; falls back to `legacyRoot` on disk for files saved before uploads moved to the database. */
export async function getStoredFile(key: string, legacyRoot: string): Promise<Buffer> {
  const row = await prisma.storedFile.findUnique({ where: { key } });
  if (row) return Buffer.from(row.data);
  const root = path.resolve(legacyRoot);
  const abs = path.resolve(root, key);
  if (!abs.startsWith(root + path.sep)) throw new Error("Invalid storage key.");
  return readFile(abs);
}

export async function deleteStoredFile(key: string): Promise<void> {
  await prisma.storedFile.deleteMany({ where: { key } });
}

/** An uploaded file's name made safe for storage keys and download headers (ASCII, no paths). */
export function safeFileName(name: string, fallback: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180) || fallback;
}
