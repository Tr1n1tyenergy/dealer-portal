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

  it("rounds an exact half cent up, like Odoo (5,000 L × 195.203703 = 976,018.515)", () => {
    const t = pfiTotals([{ product: "PMS", quantityLitres: 5000, unitPriceExVat: "195.203703" }]);
    assert.equal(t.lines[0].amount, "976018.52");
  });

  it("totals 3,000 L at 200 and 2,000 L at 185 (VAT incl.) to 970,000.00", () => {
    const t = pfiTotals([
      { product: "PMS", quantityLitres: 3000, unitPriceExVat: "185.185185" },
      { product: "AGO", quantityLitres: 2000, unitPriceExVat: "171.296296" },
    ]);
    assert.deepEqual([t.subtotal, t.vat, t.total], ["898148.15", "71851.85", "970000.00"]);
  });

  it("still totals a negative price (margins set above the base) instead of throwing", () => {
    const t = pfiTotals([{ product: "PMS", quantityLitres: 1000, unitPriceExVat: "-1.5" }]);
    assert.equal(t.subtotal, "-1500.00");
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
