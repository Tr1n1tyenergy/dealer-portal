import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pfiTotals } from "./pfi-totals";
import { fitLine, renderPfiPdf, type PfiDocument } from "./pfi-pdf";

const sample: PfiDocument = {
  number: "S01177",
  soDate: new Date("2026-10-05T09:00:00+03:00"),
  issuedAt: new Date("2026-10-05T09:05:00+03:00"),
  customerName: "RABAN ENERGY TRADING COMPANY LIMITED",
  customerId: "3680",
  addressLines: ["NAIROBI", "Kenya"],
  sourceLocation: "LakeO/Stock",
  totals: pfiTotals([
    { product: "PMS", quantityLitres: 6000, unitPriceExVat: "185.13" },
    { product: "AGO", quantityLitres: 10000, unitPriceExVat: "188.68" },
  ]),
  preparedBy: "EVAN OTIATO",
  approvedBy: "EVAN OTIATO",
};

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? []).length;

describe("renderPfiPdf", () => {
  it("produces a one-page PDF", async () => {
    const pdf = await renderPfiPdf(sample);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.equal(pageCount(pdf), 1);
  });

  it("is US Letter, like the Odoo template", async () => {
    const pdf = (await renderPfiPdf(sample)).toString("latin1");
    assert.match(pdf, /\/MediaBox \[0 0 612 792\]/);
  });

  it("uses the template's fonts, Lato Medium and Lato Bold", async () => {
    const pdf = (await renderPfiPdf(sample)).toString("latin1");
    assert.match(pdf, /\/BaseFont \/[A-Z]{6}\+Lato-Medium/);
    assert.match(pdf, /\/BaseFont \/[A-Z]{6}\+Lato-Bold/);
    assert.doesNotMatch(pdf, /\/BaseFont \/Helvetica/);
  });

  it("stays on one page with very long customer and station names", async () => {
    const pdf = await renderPfiPdf({
      ...sample,
      customerName: "VERY LONG DEALER COMPANY NAME ".repeat(4).trim(),
      addressLines: ["A STATION WITH AN UNUSUALLY LONG NAME FOR TESTING LAYOUT", "Kenya"],
    });
    assert.equal(pageCount(pdf), 1);
  });
});

describe("fitLine", () => {
  // A stand-in measure: every character is 5pt wide.
  const measure = (text: string) => text.length * 5;

  it("leaves text that fits unchanged", () => {
    assert.equal(fitLine("Kitale", 100, measure), "Kitale");
  });

  it("cuts text that is too wide and ends it with an ellipsis, within the width", () => {
    const fitted = fitLine("A STATION WITH AN UNUSUALLY LONG NAME FOR TESTING LAYOUT", 100, measure);
    assert.ok(fitted.endsWith("…"), fitted);
    assert.ok(measure(fitted) <= 100, `${fitted} is ${measure(fitted)}pt`);
  });
});
