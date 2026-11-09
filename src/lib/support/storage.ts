import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  ALLOWED_SUPPORT_MIME,
  MAX_SUPPORT_ATTACHMENT_BYTES,
} from "@/lib/support/constants";

function uploadRoot() {
  return process.env.SUPPORT_UPLOAD_DIR?.trim() || path.join(process.cwd(), ".data", "support-uploads");
}

function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180) || "attachment";
}

export type ValidatedUpload = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function validateSupportUpload(file: File): Promise<ValidatedUpload> {
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    throw new Error(`Each file must be ${MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buffer);
  if (!sniffed || !ALLOWED_SUPPORT_MIME.has(sniffed)) {
    throw new Error("Only JPEG, PNG, WebP, and PDF files are allowed.");
  }
  // Prefer sniffed type over the browser-reported MIME.
  if (file.type && file.type !== sniffed && ALLOWED_SUPPORT_MIME.has(file.type) === false) {
    // still OK if sniffed is allowed
  }
  return {
    buffer,
    fileName: safeFileName(file.name || `upload.${sniffed.split("/")[1]}`),
    mimeType: sniffed,
    sizeBytes: buffer.length,
  };
}

export async function storeSupportUpload(
  ticketId: string,
  upload: ValidatedUpload,
): Promise<{ storageKey: string }> {
  const root = uploadRoot();
  const dir = path.join(root, ticketId);
  await mkdir(dir, { recursive: true });
  const hash = createHash("sha256").update(upload.buffer).digest("hex").slice(0, 12);
  const token = randomBytes(8).toString("hex");
  const storageKey = path.join(ticketId, `${token}-${hash}-${upload.fileName}`);
  const abs = path.join(root, storageKey);
  // Prevent path escape
  if (!abs.startsWith(path.join(root, ticketId))) {
    throw new Error("Invalid storage path.");
  }
  await writeFile(abs, upload.buffer);
  return { storageKey };
}

export async function readSupportUpload(storageKey: string): Promise<Buffer> {
  const root = uploadRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    throw new Error("Invalid storage key.");
  }
  return readFile(abs);
}

export async function deleteSupportUpload(storageKey: string): Promise<void> {
  try {
    const root = uploadRoot();
    const abs = path.resolve(root, storageKey);
    if (!abs.startsWith(path.resolve(root) + path.sep)) return;
    await unlink(abs);
  } catch {
    // best-effort cleanup
  }
}
