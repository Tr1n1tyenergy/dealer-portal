import assert from "node:assert/strict";
import { priceListEndDate } from "@/lib/integrations/odoo/price-list-status";
import { describe, it } from "node:test";
import {
  deliveryWindow,
  freeText,
  isDepotAction,
  nairobiToday,
  parseDeliveryDate,
  parseLitres,
  parseOrderLines,
  parsePaymentAmount,
  typedLitres,
} from "./order-input";

const now = new Date("2026-10-15T09:00:00+03:00");
const QTY = "Quantity must be a whole number up to 100,000 L.";
const AMOUNT = "Enter the amount paid, e.g. 1,070,150.00.";

describe("litres", () => {
  it("accepts whole litres up to 100,000 and treats blank as 0", () => {
    assert.deepEqual(parseLitres("5000"), { ok: true, value: 5000 });
    assert.deepEqual(parseLitres(""), { ok: true, value: 0 });
    assert.deepEqual(parseLitres("0"), { ok: true, value: 0 });
    assert.deepEqual(parseLitres(undefined), { ok: true, value: 0 });
    assert.deepEqual(parseLitres("100000"), { ok: true, value: 100000 });
  });

  it("refuses anything else with the quantity message", () => {
    for (const bad of ["100001", "-5", "1000.5", "5e3", "abc", "2147483648", "-0"]) {
      assert.deepEqual(parseLitres(bad), { ok: false, message: QTY }, bad);
    }
  });

  it("builds order lines and drops empty products", () => {
    assert.deepEqual(parseOrderLines({ pms: "5000", ago: "" }), {
      ok: true,
      value: [{ product: "PMS", quantityLitres: 5000 }],
    });
    assert.deepEqual(parseOrderLines({ pms: "0", ago: "0" }), { ok: false, message: "Enter a quantity for PMS or AGO." });
    assert.deepEqual(parseOrderLines({ pms: "100001", ago: "5" }), { ok: false, message: QTY });
  });
});

describe("delivery date", () => {
  // A price list that runs far beyond the 90-day window, so these tests see the window alone.
  const FAR = "2099-12-31";

  it("accepts blank, today and today + 90 days", () => {
    assert.deepEqual(parseDeliveryDate("", now, FAR), { ok: true, value: null });
    assert.deepEqual(parseDeliveryDate("2026-10-15", now, FAR), { ok: true, value: "2026-10-15" });
    assert.deepEqual(parseDeliveryDate("2027-01-13", now, FAR), { ok: true, value: "2027-01-13" });
  });

  it("refuses past, too-far, impossible and non-dates with the window message", () => {
    const message = "Choose a delivery date between 15 Oct 2026 and 13 Jan 2027.";
    for (const bad of ["2026-10-14", "2027-01-14", "2026-02-30", "banana"]) {
      assert.deepEqual(parseDeliveryDate(bad, now, FAR), { ok: false, message }, bad);
    }
  });

  it("uses the Nairobi calendar day around midnight", () => {
    const justAfterMidnight = new Date("2026-10-14T21:30:00Z"); // 00:30 on 15 Oct in Nairobi
    assert.equal(nairobiToday(justAfterMidnight), "2026-10-15");
    assert.equal(parseDeliveryDate("2026-10-14", justAfterMidnight, FAR).ok, false);
    assert.deepEqual(deliveryWindow(justAfterMidnight, FAR), { min: "2026-10-15", max: "2027-01-13" });
  });

  it("stops at the last day of the current EPRA price list", () => {
    assert.deepEqual(deliveryWindow(now, "2026-11-14"), { min: "2026-10-15", max: "2026-11-14" });
    assert.deepEqual(parseDeliveryDate("2026-11-14", now, "2026-11-14"), { ok: true, value: "2026-11-14" });
    assert.deepEqual(parseDeliveryDate("2026-11-15", now, "2026-11-14"), {
      ok: false,
      message: "Choose a delivery date between 15 Oct 2026 and 14 Nov 2026.",
    });
  });

  it("allows only today once the price list has run out", () => {
    const afterList = new Date("2026-11-16T09:00:00Z");
    assert.deepEqual(deliveryWindow(afterList, "2026-11-14"), { min: "2026-11-16", max: "2026-11-16" });
    assert.equal(parseDeliveryDate("2026-11-17", afterList, "2026-11-14").ok, false);
  });

  it("uses the portal's own price list by default", () => {
    const { max } = deliveryWindow(now);
    assert.ok(max <= priceListEndDate(), `${max} should not pass ${priceListEndDate()}`);
  });
});

describe("payment amount", () => {
  it("normalises valid amounts to two decimals", () => {
    assert.deepEqual(parsePaymentAmount("1,070,150.00"), { ok: true, value: "1070150.00" });
    assert.deepEqual(parsePaymentAmount("1070150"), { ok: true, value: "1070150.00" });
    assert.deepEqual(parsePaymentAmount(" 1,000.5 "), { ok: true, value: "1000.50" });
  });

  it("refuses non-money, zero and badly grouped amounts", () => {
    for (const bad of ["-999999abc", "0", "0.00", "1.234", "KES 1000", "1,00,000", "", undefined]) {
      assert.deepEqual(parsePaymentAmount(bad), { ok: false, message: AMOUNT }, String(bad));
    }
  });
});

describe("depot action", () => {
  it("only allows the known actions", () => {
    assert.equal(isDepotAction("accept"), true);
    assert.equal(isDepotAction("close"), true);
    assert.equal(isDepotAction("bogus"), false);
    assert.equal(isDepotAction(""), false);
  });
});

describe("typed litres", () => {
  it("keeps only digits, so commas and pasted text work", () => {
    assert.equal(typedLitres("25000"), 25000);
    assert.equal(typedLitres("25,000"), 25000);
    assert.equal(typedLitres("12a3.5-"), 1235);
  });

  it("treats an empty box as 0 and stops at 100,000", () => {
    assert.equal(typedLitres(""), 0);
    assert.equal(typedLitres("100001"), 100000);
    assert.equal(typedLitres("99999999999999999999"), 100000);
  });
});

describe("freeText", () => {
  it("trims, drops empty values and caps at 500 characters", () => {
    assert.equal(freeText("  PO-123  "), "PO-123");
    assert.equal(freeText(""), undefined);
    assert.equal(freeText("   "), undefined);
    assert.equal(freeText(null), undefined);
    assert.equal(freeText("x".repeat(5000))?.length, 500);
  });
});
