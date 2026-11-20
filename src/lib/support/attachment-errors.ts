/** What a failed attachment download tells the person: the two known reasons, otherwise a plain "Not found"
 *  (database and file-system errors can name hosts and server paths). */
export function attachmentDownloadError(err: unknown): { message: string; status: 403 | 404 } {
  const message = err instanceof Error ? err.message : "";
  if (message === "Forbidden.") return { message, status: 403 };
  if (message === "Attachment not found.") return { message, status: 404 };
  return { message: "Not found", status: 404 };
}
