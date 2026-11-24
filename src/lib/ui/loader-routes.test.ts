import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinationLabel, loaderFor, markSplashPending, portalKey, takeSplash } from "./loader-routes";

describe("which loader a navigation shows", () => {
  it("knows the portal or module a path belongs to", () => {
    assert.equal(portalKey("/intelligence/dashboard"), "intelligence/dashboard");
    assert.equal(portalKey("/intelligence/retail/orders/abc"), "intelligence/retail");
    assert.equal(portalKey("/intelligence/note-taker/x/notes"), "intelligence/note-taker");
    assert.equal(portalKey("/dealer/orders"), "dealer");
    assert.equal(portalKey("/depot/dashboard"), "depot");
    assert.equal(portalKey("/"), "");
  });

  it("shows the portal orbit only when the portal or module changes", () => {
    assert.equal(loaderFor("/intelligence/dashboard", "/intelligence/retail"), "portal");
    assert.equal(loaderFor("/intelligence/retail/orders", "/intelligence/note-taker"), "portal");
    assert.equal(loaderFor("/intelligence/retail/orders", "/intelligence/retail/analytics"), "page");
    assert.equal(loaderFor("/dealer/dashboard", "/dealer/orders?tab=open"), "page");
    assert.equal(loaderFor("/intelligence/retail", "/intelligence/retail?tab=x"), "page");
  });

  it("names where you are going", () => {
    assert.equal(destinationLabel("/intelligence/retail"), "Retail");
    assert.equal(destinationLabel("/intelligence/retail/orders/abc"), "Orders");
    assert.equal(destinationLabel("/intelligence/retail/stock-reporting"), "Stock Reporting");
    assert.equal(destinationLabel("/intelligence/note-taker"), "Note Taker");
    assert.equal(destinationLabel("/intelligence/dashboard"), "your modules");
    assert.equal(destinationLabel("/dealer/dashboard"), "Home");
    assert.equal(destinationLabel("/dealer/messages"), "Messages");
    assert.equal(destinationLabel("/depot/dashboard"), "Depot Board");
    assert.equal(destinationLabel("/somewhere/odd-thing"), "the page");
  });
});

describe("sign-in splash flag", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it("shows once per sign-in", () => {
    const s = store();
    assert.equal(takeSplash(s), false);
    markSplashPending(s);
    assert.equal(takeSplash(s), true);
    assert.equal(takeSplash(s), false);
  });

  it("never throws when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    assert.doesNotThrow(() => markSplashPending(blocked));
    assert.equal(takeSplash(blocked), false);
  });
});
