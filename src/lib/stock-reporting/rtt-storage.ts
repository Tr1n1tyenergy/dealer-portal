import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { deleteStoredFile, getStoredFile, putStoredFile } from "@/lib/files/stored-files";

import { RTT_JOB_CARD_MAX_BYTES } from "./rtt-constants";

export const MAX_RTT_JOB_CARD_BYTES = RTT_JOB_CARD_MAX_BYTES;
export const RTT_JOB_CARD_MIME = "application/pdf";

function uploadRoot() {
  return (
    process.env.RTT_UPLOAD_DIR?.trim() ||
    path.join(process.cwd(), ".data", "rtt-job-cards")
  );
}

function sniffPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-";
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180) || "job-card.pdf";
}

export type ValidatedRttJobCard = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function validateRttJobCard(file: File): Promise<ValidatedRttJobCard> {
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MAX_RTT_JOB_CARD_BYTES) {
    throw new Error("Job card must be 10 MB or smaller.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffPdf(buffer)) {
    throw new Error("Job card must be a PDF file.");
  }
  const name = safeFileName(file.name || "job-card.pdf");
  const withExt = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  return {
    buffer,
    fileName: withExt,
    mimeType: RTT_JOB_CARD_MIME,
    sizeBytes: buffer.length,
  };
}

export async function storeRttJobCard(
  stationId: string,
  eventId: string,
  upload: ValidatedRttJobCard
): Promise<{ storageKey: string }> {
  const hash = createHash("sha256").update(upload.buffer).digest("hex").slice(0, 12);
  const token = randomBytes(8).toString("hex");
  const storageKey = path.join(stationId, eventId, `${token}-${hash}-${upload.fileName}`);
  await putStoredFile(storageKey, upload.buffer);
  return { storageKey };
}

export async function readRttJobCard(storageKey: string): Promise<Buffer> {
  return getStoredFile(storageKey, uploadRoot());
}

export async function deleteRttJobCard(storageKey: string): Promise<void> {
  await deleteStoredFile(storageKey).catch(() => undefined); // best-effort cleanup
}
