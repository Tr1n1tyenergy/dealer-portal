import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachmentDownloadError } from "./attachment-errors";

describe("attachment download errors shown to the person", () => {
  it("passes through the two known reasons", () => {
    assert.deepEqual(attachmentDownloadError(new Error("Forbidden.")), { message: "Forbidden.", status: 403 });
    assert.deepEqual(attachmentDownloadError(new Error("Attachment not found.")), { message: "Attachment not found.", status: 404 });
  });

  it("never shows database or file-system details", () => {
    const leaks = [
      new Error("Can't reach database server at `ep-quiet-wildflower-zaag2pmh.neon.tech:5432`"),
      new Error("ENOENT: no such file or directory, open '/var/task/.data/support-uploads/t1/x.pdf'"),
      "a string",
    ];
    for (const err of leaks) {
      assert.deepEqual(attachmentDownloadError(err), { message: "Not found", status: 404 });
    }
  });
});
