import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readJson } from "./read-json";

const post = (body?: string) => new Request("http://localhost/api", { method: "POST", body });

describe("readJson", () => {
  it("returns the parsed body", async () => {
    assert.deepEqual(await readJson(post('{"a":1}')), { a: 1 });
  });

  it("returns undefined for malformed JSON", async () => {
    assert.equal(await readJson(post("{oops")), undefined);
  });

  it("returns undefined for an empty body", async () => {
    assert.equal(await readJson(post("")), undefined);
    assert.equal(await readJson(post()), undefined);
  });

  it("keeps a literal null", async () => {
    assert.equal(await readJson(post("null")), null);
  });
});
