import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dealerOrderViewWhere,
  DEALER_ORDER_VIEWS,
  orderNeighbours,
  parseDealerOrderView,
  toDealerOrderRow,
} from "./dealer-views";

describe("parseDealerOrderView", () => {
  it("keeps the three tabs", () => {
    for (const view of ["payment", "documents", "deliveries"] as const) {
      assert.equal(parseDealerOrderView(view), view);
    }
  });

  it("falls back to all for anything else", () => {
    for (const value of [undefined, "foo", "", ["payment", "x"]]) {
      assert.equal(parseDealerOrderView(value), "all");
    }
  });
});

describe("dealerOrderViewWhere", () => {
  it("filters each tab by the spec's statuses", () => {
    assert.deepEqual(dealerOrderViewWhere("all"), {});
    assert.deepEqual(dealerOrderViewWhere("payment"), {
      status: { in: ["PFI_ISSUED", "AWAITING_PAYMENT", "PAYMENT_EXCEPTION"] },
    });
    assert.deepEqual(dealerOrderViewWhere("deliveries"), {
      status: {
        in: [
          "RELEASED_TO_DEPOT",
          "LOADING",
          "LOADED",
          "DISPATCHED",
          "IN_TRANSIT",
          "DELIVERY_EXCEPTION",
          "DELIVERED",
          "CLOSED",
        ],
      },
    });
    assert.deepEqual(dealerOrderViewWhere("documents"), { proforma: { isNot: null } });
  });

  it("lists the tabs in order with their links", () => {
    assert.deepEqual(
      DEALER_ORDER_VIEWS.map((v) => [v.view, v.label, v.href]),
      [
        ["all", "All", "/dealer/orders"],
        ["payment", "Needs payment", "/dealer/orders?view=payment"],
        ["documents", "PFIs & Documents", "/dealer/orders?view=documents"],
        ["deliveries", "Deliveries", "/dealer/orders?view=deliveries"],
      ],
    );
  });
});

describe("orderNeighbours", () => {
  const newestFirst = [{ id: "c" }, { id: "b" }, { id: "a" }];

  it("gives the older and newer order around the current one", () => {
    assert.deepEqual(orderNeighbours(newestFirst, "b"), { older: "a", newer: "c" });
    assert.deepEqual(orderNeighbours(newestFirst, "c"), { older: "b", newer: null });
    assert.deepEqual(orderNeighbours(newestFirst, "a"), { older: null, newer: "b" });
  });

  it("has no neighbours for a single or unknown order", () => {
    assert.deepEqual(orderNeighbours([{ id: "a" }], "a"), { older: null, newer: null });
    assert.deepEqual(orderNeighbours(newestFirst, "zzz"), { older: null, newer: null });
  });
});

describe("toDealerOrderRow", () => {
  const base = {
    id: "o1",
    reference: "DO-2026-000001",
    status: "AWAITING_PAYMENT",
    createdAt: new Date("2026-10-19T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:00:00Z"),
    station: { name: "Kitale" },
    lines: [
      { product: "PMS", quantityLitres: 6000 },
      { product: "AGO", quantityLitres: 10000 },
    ],
  };

  it("maps an order to a table row", () => {
    const row = toDealerOrderRow({ ...base, proforma: { id: "p1" } } as never);
    assert.equal(row.reference, "DO-2026-000001");
    assert.equal(row.stationName, "Kitale");
    assert.equal(row.pms, 6000);
    assert.equal(row.ago, 10000);
    assert.equal(row.statusLabel, "Awaiting Payment");
    assert.equal(row.tone, "payment");
    assert.equal(row.hasPfi, true);
    assert.equal(row.createdAt, "2026-10-19T10:00:00.000Z");
  });

  it("has no PFI link without a PFI and no AGO without an AGO line", () => {
    const row = toDealerOrderRow({ ...base, lines: [base.lines[0]], proforma: null } as never);
    assert.equal(row.hasPfi, false);
    assert.equal(row.ago, null);
  });
});
