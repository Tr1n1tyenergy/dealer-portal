import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinationLabel, loaderFor, markSplashPending, portalKey, rscTarget, takeSplash } from "./loader-routes";

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

  it("calls the staff Retail start page Home inside Retail, as the menu does, and Retail when opening it", () => {
    assert.equal(destinationLabel("/intelligence/retail", "page"), "Home");
    assert.equal(destinationLabel("/intelligence/retail?tab=x", "page"), "Home");
    assert.equal(destinationLabel("/intelligence/retail", "portal"), "Retail");
    assert.equal(destinationLabel("/intelligence/retail/orders", "page"), "Orders");
  });
});

describe("where a page request is going", () => {
  it("reads the destination from Next's page-data request, without its cache-busting parameter", () => {
    assert.equal(rscTarget("http://localhost:3996/dealer/support?_rsc=1x2y", "http://localhost:3996/dealer/orders"), "/dealer/support");
    assert.equal(rscTarget("/intelligence/retail/orders?stage=depot&_rsc=abc", "http://x.test/intelligence/retail"), "/intelligence/retail/orders?stage=depot");
    assert.equal(rscTarget(new URL("https://portal.test/depot/dashboard?_rsc=9"), "https://portal.test/access"), "/depot/dashboard");
  });

  it("gives nothing for requests to other sites or unreadable input", () => {
    assert.equal(rscTarget("https://elsewhere.test/x?_rsc=1", "https://portal.test/"), undefined);
    assert.equal(rscTarget("http://[bad", "https://portal.test/"), undefined);
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
