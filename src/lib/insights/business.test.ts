import { test } from "node:test";
import assert from "node:assert/strict";
import { dealersWaiting, depotsToday, goneQuiet, monthFigures, onTheWay, regionOf, regionTotals, todayFigures, topDealers, toPay } from "./business";

const now = new Date("2026-11-20T09:00:00Z");
const D = 86400e3;

test("region from the station's loading warehouse", () => {
  assert.equal(regionOf("athiriver"), "Nairobi");
  assert.equal(regionOf("sobea"), "Nakuru");
  assert.equal(regionOf("kitale"), "Eldoret");
  assert.equal(regionOf("kisii"), "Kisumu");
  assert.equal(regionOf("nowhere"), null);
  assert.equal(regionOf(null), null);
});

test("region totals: four regions in order, Nairobi month edges", () => {
  const rows = [
    { stationCode: "athiriver", litres: 5000, createdAt: new Date("2026-10-31T22:30:00Z") }, // 1 Nov Nairobi
    { stationCode: "athiriver", litres: 3000, createdAt: new Date("2026-10-31T20:00:00Z") }, // 31 Oct Nairobi
    { stationCode: "kitale", litres: 2000, createdAt: new Date("2026-11-05T08:00:00Z") },
  ];
  assert.deepEqual(regionTotals(rows, now), [
    { region: "Nairobi", thisMonth: 5000, lastMonth: 3000 },
    { region: "Nakuru", thisMonth: 0, lastMonth: 0 },
    { region: "Eldoret", thisMonth: 2000, lastMonth: 0 },
    { region: "Kisumu", thisMonth: 0, lastMonth: 0 },
  ]);
});

test("top dealers, biggest first", () => {
  assert.deepEqual(topDealers([{ dealer: "A", litres: 5 }, { dealer: "B", litres: 9 }, { dealer: "C", litres: 7 }], 2), [
    { dealer: "B", litres: 9 },
    { dealer: "C", litres: 7 },
  ]);
});

test("gone quiet: over 30 days or never ordered, oldest first", () => {
  const r = goneQuiet(
    [
      { name: "Recent", lastOrderAt: new Date(now.getTime() - 29 * D) },
      { name: "Quiet", lastOrderAt: new Date(now.getTime() - 31 * D) },
      { name: "Never", lastOrderAt: null },
    ],
    now,
  );
  assert.deepEqual(r.map((x) => [x.name, x.days]), [["Never", null], ["Quiet", 31]]);
});

test("month figures: cancelled left out, active dealers distinct, last month alongside", () => {
  const o = (at: string, status: string, amountDue: string | null, litres: number, dealerId: string) => ({
    createdAt: new Date(at), status, amountDue, dealerId, lines: [{ product: "PMS", quantityLitres: litres }],
  });
  const r = monthFigures(
    [
      o("2026-11-02T08:00:00Z", "DELIVERED", "1000.50", 5000, "d1"),
      o("2026-11-03T08:00:00Z", "AWAITING_PAYMENT", "2000.25", 3000, "d1"),
      o("2026-11-04T08:00:00Z", "CANCELLED", "9999.00", 9000, "d2"),
      o("2026-10-10T08:00:00Z", "DELIVERED", "500.00", 1000, "d2"),
    ] as never,
    now,
  );
  assert.deepEqual(r, {
    litres: 8000, value: "3000.75", orders: 2, activeDealers: 1,
    prev: { litres: 1000, value: "500.00", orders: 1, activeDealers: 1 },
  });
});

test("today figures on the Nairobi day", () => {
  const nowT = new Date("2026-11-20T09:00:00Z"); // 12:00 Nairobi
  const r = todayFigures(
    {
      orders: [
        { createdAt: new Date("2026-11-19T21:30:00Z"), status: "SUBMITTED", litres: 4000 }, // 20 Nov 00:30 Nairobi
        { createdAt: new Date("2026-11-19T20:30:00Z"), status: "SUBMITTED", litres: 4000 }, // 19 Nov
        { createdAt: new Date("2026-11-20T05:00:00Z"), status: "CANCELLED", litres: 4000 },
      ],
      confirmations: [{ at: new Date("2026-11-20T06:00:00Z"), amount: "1225746.00" }, { at: new Date("2026-11-19T06:00:00Z"), amount: "1.00" }],
      dispatches: [{ at: new Date("2026-11-20T07:00:00Z"), litres: 5000 }],
    },
    nowT,
  );
  assert.deepEqual(r, { newOrders: 1, newOrdersYesterday: 1, litresOrdered: 4000, paymentsConfirmed: 1, paymentsValue: "1225746.00", litresDispatched: 5000 });
});

test("to pay: PFIs waiting, total to the cent, oldest wait", () => {
  const r = toPay(
    [
      { status: "AWAITING_PAYMENT", amountDue: "1225746.00", enteredAt: new Date(now.getTime() - 2 * D) },
      { status: "PAYMENT_EXCEPTION", amountDue: "1225746.00", enteredAt: new Date(now.getTime() - D) },
      { status: "DELIVERED", amountDue: "5.00", enteredAt: now },
    ] as never,
    now,
  );
  assert.deepEqual(r, { total: "2451492.00", count: 2, oldestMs: 2 * D });
  assert.deepEqual(toPay([], now), { total: "0.00", count: 0, oldestMs: null });
});

test("on the way: furthest along wins, newest breaks ties, the rest counted", () => {
  const t = (iso: string) => new Date(iso);
  assert.deepEqual(
    onTheWay([
      { id: "load", status: "LOADING", updatedAt: t("2026-11-20T08:00:00Z") },
      { id: "road", status: "IN_TRANSIT", updatedAt: t("2026-11-19T08:00:00Z") },
      { id: "paid", status: "AWAITING_PAYMENT", updatedAt: t("2026-11-20T08:00:00Z") },
    ] as never),
    { current: "road", more: 1 },
  );
  assert.deepEqual(onTheWay([]), { current: null, more: 0 });
});

test("dealersWaiting: threads whose latest message is from a dealer, longest first", () => {
  const w = dealersWaiting(
    [
      { lastAt: new Date(now.getTime() - 2 * 3600e3), dealer: "Maili Tatu" },
      { lastAt: new Date(now.getTime() - 20 * 60e3), dealer: "Sobea" },
      { lastAt: new Date(now.getTime() - 5 * 3600e3), dealer: null }, // staff spoke last
    ],
    now,
  );
  assert.deepEqual(w, { count: 2, longestMs: 2 * 3600e3, dealer: "Maili Tatu" });
  assert.deepEqual(dealersWaiting([], now), { count: 0, longestMs: 0, dealer: null });
});

test("depotsToday: loading now and dispatched today (Nairobi day) per depot", () => {
  const rows = depotsToday(
    ["Eldoret", "Nakuru"],
    [{ depot: "Nakuru" }, { depot: "Nakuru" }],
    [
      { depot: "Nakuru", at: new Date("2026-11-20T06:00:00Z") },
      { depot: "Eldoret", at: new Date("2026-11-19T20:30:00Z") }, // 23:30 Nairobi yesterday
    ],
    now,
  );
  assert.deepEqual(rows, [
    { depot: "Eldoret", loading: 0, dispatched: 0 },
    { depot: "Nakuru", loading: 2, dispatched: 1 },
  ]);
});
