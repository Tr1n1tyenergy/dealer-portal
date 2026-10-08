import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { mayExposeSensitiveAuthUrls } from "./expose-sensitive-urls";

const env = process.env as Record<string, string | undefined>;

describe("sensitive auth URL exposure", () => {
  const prevNode = env.NODE_ENV;
  const prevFlag = env.TRI_EXPOSE_DEV_AUTH_URLS;

  beforeEach(() => {
    delete env.TRI_EXPOSE_DEV_AUTH_URLS;
  });

  afterEach(() => {
    if (prevNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = prevNode;
    if (prevFlag === undefined) delete env.TRI_EXPOSE_DEV_AUTH_URLS;
    else env.TRI_EXPOSE_DEV_AUTH_URLS = prevFlag;
  });

  it("never exposes in production", () => {
    env.NODE_ENV = "production";
    env.TRI_EXPOSE_DEV_AUTH_URLS = "1";
    assert.equal(mayExposeSensitiveAuthUrls(), false);
  });

  it("requires explicit opt-in outside production", () => {
    env.NODE_ENV = "development";
    assert.equal(mayExposeSensitiveAuthUrls(), false);
    env.TRI_EXPOSE_DEV_AUTH_URLS = "1";
    assert.equal(mayExposeSensitiveAuthUrls(), true);
  });
});
