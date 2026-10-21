import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney, formatVolume, pfiTotals } from "./pfi-totals";

describe("pfiTotals", () => {
  it("reproduces the S01177 template figures", () => {
    const t = pfiTotals([
      { product: "PMS", quantityLitres: 6000, unitPriceExVat: "185.1296296296" },
      { product: "AGO", quantityLitres: 10000, unitPriceExVat: "188.67592593" },
    ]);
    assert.deepEqual(t.lines.map((l) => l.amount), ["1110777.78", "1886759.26"]);
    assert.equal(t.subtotal, "2997537.04");
    assert.equal(t.vat, "239802.96");
    assert.equal(t.total, "3237340.00");
    assert.equal(t.vatRate, "0.08");
  });

  it("adds 8% on top of portal prices", () => {
    const t = pfiTotals([{ product: "PMS", quantityLitres: 5000, unitPriceExVat: "223.96" }]);
    assert.deepEqual([t.subtotal, t.vat, t.total], ["1119800.00", "89584.00", "1209384.00"]);
  });

  it("works in cents without float drift", () => {
    const t = pfiTotals([{ product: "AGO", quantityLitres: 3, unitPriceExVat: "0.10" }]);
    assert.deepEqual([t.subtotal, t.vat, t.total], ["0.30", "0.02", "0.32"]);
  });
});

describe("PFI formatting", () => {
  it("formats money and volume", () => {
    assert.equal(formatMoney("1110777.78"), "1,110,777.78");
    assert.equal(formatMoney("0.30"), "0.30");
    assert.equal(formatVolume(6000), "6,000");
  });
});
