import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_SUPPORT_UPLOAD_TOTAL_BYTES, supportUploadProblem } from "./constants";
import { RTT_JOB_CARD_MAX_BYTES } from "@/lib/stock-reporting/rtt-constants";

const MB = 1024 * 1024;

describe("upload limits fit Vercel's 4.5 MB request body", () => {
  it("caps the combined attachments at 4 MB, and a job card at 4 MB", () => {
    assert.equal(MAX_SUPPORT_UPLOAD_TOTAL_BYTES, 4 * MB);
    assert.equal(RTT_JOB_CARD_MAX_BYTES, 4 * MB);
  });

  it("accepts files that add up to 4 MB", () => {
    assert.equal(supportUploadProblem([2 * MB, 2 * MB]), null);
    assert.equal(supportUploadProblem([]), null);
  });

  it("refuses files that add up to more than 4 MB, saying the limit", () => {
    assert.match(supportUploadProblem([3 * MB, 1.5 * MB]) ?? "", /4 MB in total/);
  });

  it("refuses more than 5 files", () => {
    assert.match(supportUploadProblem([1, 1, 1, 1, 1, 1]) ?? "", /up to 5 files/);
  });
});
