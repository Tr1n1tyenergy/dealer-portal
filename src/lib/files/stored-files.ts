import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

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
