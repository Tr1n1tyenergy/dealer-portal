import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PFI_BANK_ACCOUNTS, PFI_COMPANY } from "@/lib/company/pfi-settings";
import { formatMoney, formatVolume, type PfiTotals } from "@/lib/orders/pfi-totals";

/** Everything printed on a PFI, frozen when it was issued (see loadPfiDocument). */
export type PfiDocument = {
  number: string;
  soDate: Date;
  issuedAt: Date;
  customerName: string;
  customerId: string;
  addressLines: string[];
  sourceLocation: string;
  totals: PfiTotals;
  preparedBy: string;
  approvedBy: string;
};

/*
 * Layout copied 1:1 from Trinity's Odoo template ("Sale PRO-FORMA Invoice - S01177.pdf"):
 * US Letter, Lato Medium / Lato Bold, blue #2b76b6 bars, black 0.65pt rules, the same
 * positions (points from the top-left corner). The footer is drawn: a #3854a3 → #32c1d1
 * gradient band with the company details.
 */
const BLUE = "#2b76b6";
const FOOTER_FROM = "#3854a3";
const FOOTER_TO = "#32c1d1";
const BLACK = "#000000";
const RULE = 0.65;
const LEFT = 9.6;
/** The right-hand rule sits at 601.8 (0.6 wide), as on the template; the footer band runs to 602.4. */
const RIGHT = 601.8;
const WIDTH = RIGHT - LEFT;
const FOOTER_WIDTH = 592.8;
const DESCRIPTIONS = { PMS: "PMS LOCAL", AGO: "AGO LOCAL" } as const;

const ASSETS = path.join(process.cwd(), "assets/pfi");
const assetCache = new Map<string, Buffer | null>();
function asset(name: string): Buffer | null {
  if (!assetCache.has(name)) {
    try {
      assetCache.set(name, readFileSync(path.join(ASSETS, name)));
    } catch {
      assetCache.set(name, null);
    }
  }
  return assetCache.get(name) ?? null;
}

/** Shorten text to one line of the given width, ending it with "…" when it had to be cut. */
export function fitLine(text: string, width: number, measure: (text: string) => number): string {
  if (measure(text) <= width) return text;
  let cut = text;
  while (cut.length > 0 && measure(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

const kenyaDate = (date: Date, style: "long" | "dotted") => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: style === "long" ? "short" : "2-digit", year: "numeric" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return style === "long" ? `${parts.day} ${parts.month} ${parts.year}` : `${parts.day}.${parts.month}.${parts.year}`;
};

/** Draw the PFI as a one-page US Letter PDF laid out exactly like Trinity's Odoo pro-forma template. */
export function renderPfiPdf(data: PfiDocument): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 0, info: { Title: `Pro-Forma Invoice ${data.number}`, Author: PFI_COMPANY.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const medium = asset("lato-medium.woff");
  const bold = asset("lato-bold.woff");
  doc.registerFont("Body", medium ?? "Helvetica");
  doc.registerFont("Label", bold ?? "Helvetica-Bold");

  // Rules and cells. The template draws each rule as a strip starting at its coordinate (to the
  // right / below), so strokes are offset by half their width to land on the same pixels.
  const rect = (x: number, top: number, w: number, h: number) =>
    doc.lineWidth(RULE).rect(x + RULE / 2, top + RULE / 2, w, h).stroke(BLACK);
  const blueCell = (x: number, top: number, w: number, h: number) => {
    doc.rect(x, top, w, h).fill(BLUE);
    rect(x, top, w, h);
  };

  /** One line of text placed on its baseline; anything wider than its column is cut with "…". */
  const text = (
    value: string,
    x: number,
    baseline: number,
    width: number,
    opts: { font?: "Body" | "Label"; size?: number; color?: string; align?: "left" | "center" | "right" } = {},
  ) => {
    const { font = "Body", size = 9, color = BLACK, align = "left" } = opts;
    doc.font(font).fontSize(size).fillColor(color);
    const line = fitLine(value, width, (t) => doc.widthOfString(t));
    doc.text(line, x, baseline, { width, align, lineBreak: false, baseline: "alphabetic" });
  };

  // Header: the logo where the template has it (its artwork spans x 34.7–209.2, top 16.4–67.9)
  const logo = asset("logo.png");
  if (logo) doc.image(logo, 30.5, -0.7, { width: 185.3 });

  // Title bar
  blueCell(LEFT, 99.2, WIDTH, 31.4);
  text("PRO-FORMA INVOICE", LEFT, 119.7, WIDTH, { font: "Label", size: 15.4, color: "#ffffff", align: "center" });

  // SO number and date
  rect(LEFT, 130.6, 89, 20.5);
  rect(98.6, 130.6, 236.8, 20.5);
  rect(335.4, 130.6, 147.9, 20.5);
  rect(483.3, 130.6, RIGHT - 483.3, 20.5);
  text("SO No.", 13.4, 144.0, 84);
  text(data.number, 102.4, 144.0, 230);
  text("SO DATE:", 339.3, 144.0, 140);
  text(kenyaDate(data.soDate, "long"), 487.2, 144.0, RIGHT - 490);

  // Customer and terms
  rect(LEFT, 151.1, 325.8, 80.0);
  rect(335.4, 151.1, RIGHT - 335.4, 80.0);
  text("CUSTOMER:", 13.4, 169.0, 86, { font: "Label" });
  // The customer name may take two lines (8.9pt apart, as on the template), then it is cut.
  doc.font("Body").fontSize(9);
  const nameWords = data.customerName.split(/\s+/);
  let firstLine = "";
  while (nameWords.length && doc.widthOfString(`${firstLine} ${nameWords[0]}`.trim()) <= 175) firstLine = `${firstLine} ${nameWords.shift()}`.trim();
  text(firstLine || data.customerName, 101.8, 169.0, 230);
  if (firstLine && nameWords.length) text(nameWords.join(" "), 101.8, 177.9, 230);
  text("CUSTOMER ID:", 13.4, 193.3, 86, { font: "Label" });
  text(data.customerId, 101.8, 193.3, 230);
  text("ADDRESS:", 13.4, 210.6, 86, { font: "Label" });
  data.addressLines.slice(0, 2).forEach((line, i) => text(line, 101.8, 210.6 + i * 13.4, 230));
  const terms: [string, string][] = [
    ["Payment Terms:", PFI_COMPANY.paymentTerms],
    ["Currency", `${PFI_COMPANY.currency} (1)`],
    ["Source Location:", data.sourceLocation],
  ];
  terms.forEach(([label, value], i) => {
    text(label, 339.3, 195.9 + i * 15.35, 120, { font: "Label" });
    text(value, 461.6, 195.9 + i * 15.35, RIGHT - 463);
  });

  // Line table
  const cols = [
    { x: LEFT, w: 29.5, align: "left" as const },
    { x: 39.1, w: 135.7, align: "left" as const },
    { x: 174.8, w: 60.1, align: "left" as const },
    { x: 234.9, w: 93.5, align: "right" as const },
    { x: 328.4, w: 158.1, align: "right" as const },
    { x: 486.5, w: RIGHT - 486.5, align: "right" as const },
  ];
  const headers = ["", "DESCRIPTION", "UOM", "VOLUME", "UNIT PRICE", "AMOUNT"];
  cols.forEach((col) => blueCell(col.x, 231.7, col.w, 24.3));
  text("ITEM", LEFT, 242.6, 29.5, { font: "Label", color: "#ffffff", align: "center" });
  text("NO", LEFT, 251.6, 29.5, { font: "Label", color: "#ffffff", align: "center" });
  headers.forEach((label, i) => {
    if (label) text(label, cols[i].x, 242.6, cols[i].w, { font: "Label", color: "#ffffff", align: "center" });
  });
  let top = 256.0;
  data.totals.lines.forEach((line, i) => {
    // Unit price is printed exactly as stored.
    const cells = [String(i + 1), DESCRIPTIONS[line.product], "L", formatVolume(line.quantityLitres), line.unitPriceExVat, formatMoney(line.amount)];
    cols.forEach((col, c) => {
      rect(col.x, top, col.w, 16);
      if (col.align === "right") text(cells[c], col.x, top + 11.6, col.w - 2.6, { align: "right" });
      else text(cells[c], col.x + 3.8, top + 11.6, col.w - 5);
    });
    top += 16;
  });
  const labelWidth = 486.5 - LEFT;
  const totalRows: [string, string][] = [["Sub Total", data.totals.subtotal], ["VAT", data.totals.vat], ["Total", data.totals.total]];
  for (const [label, value] of totalRows) {
    rect(LEFT, top, labelWidth, 20.5);
    rect(486.5, top, RIGHT - 486.5, 20.5);
    text(label, LEFT, top + 13.5, labelWidth, { font: "Label", align: "center" });
    text(formatMoney(value), 486.5, top + 13.5, RIGHT - 486.5 - 2.6, { align: "right" });
    top += 20.5;
  }

  // Bank account details, at the template's spacing below the totals
  let bankTop = top + 4.5;
  blueCell(LEFT, bankTop, WIDTH, 13.4);
  text("Bank Account Details", 15.4, bankTop + 9.6, 200, { font: "Label", size: 7.7, color: "#ffffff" });
  bankTop += 13.4;
  const bankRows: [string, keyof (typeof PFI_BANK_ACCOUNTS)[number]][] = [
    ["Bank:", "bank"],
    ["Beneficiary:", "beneficiary"],
    ["Account Number:", "accountNumber"],
    ["Beneficiary Bank:", "beneficiaryBank"],
    ["Swift Code:", "swiftCode"],
  ];
  const bankCols = [
    { label: LEFT, value: 98.6, end: 306.0 },
    { label: 306.0, value: 395.0, end: RIGHT },
  ];
  bankRows.forEach(([label, key]) => {
    PFI_BANK_ACCOUNTS.forEach((account, a) => {
      const c = bankCols[a];
      rect(c.label, bankTop, c.value - c.label, 12.2);
      rect(c.value, bankTop, c.end - c.value, 12.2);
      text(label, c.label + 4.5, bankTop + 9.0, c.value - c.label - 6, { font: "Label", size: 7.7 });
      text(account[key], c.value + 4.5, bankTop + 9.0, c.end - c.value - 6, { size: 7.7 });
    });
    bankTop += 12.2;
  });

  // Signatures; with two lines the template has Prepared By at 443.0 and Approved By at 491.0
  const shift = bankTop - 428.4;
  const issued = kenyaDate(data.issuedAt, "dotted");
  const signatures: [string, string, number][] = [
    ["Prepared By:", data.preparedBy, 443.0],
    ["Approved By:", data.approvedBy, 491.0],
  ];
  for (const [label, name, at] of signatures) {
    const y = at + shift;
    text(label, LEFT, y, 200, { font: "Label", size: 7.7 });
    text(name, LEFT, y + 17.9, 236, { size: 7.7 });
    text("Date:", 306.0, y + 15.3, 22, { font: "Label", size: 7.7 });
    text(issued, 326.5, y + 15.3, 200, { size: 7.7 });
    for (const x of [LEFT, 305.6]) doc.rect(x, y + 29.5, 236.9, 0.6).fill("#d0d0d0");
  }

  // Terms and conditions (left empty, as on the template)
  const termsTop = 532.6 + shift;
  blueCell(LEFT, termsTop, WIDTH, 28.8);
  text("Terms and Conditions", 16.6, termsTop + 17.3, 300, { font: "Label", size: 10.2, color: "#ffffff" });
  rect(LEFT, termsTop + 28.8, WIDTH, 13.4);

  // Footer: gradient band with the company name, contacts and address
  const footerTop = 678.4;
  const scale = FOOTER_WIDTH / 575;
  const gradient = doc.linearGradient(LEFT, footerTop, LEFT + FOOTER_WIDTH, footerTop).stop(0, FOOTER_FROM).stop(1, FOOTER_TO);
  doc.rect(LEFT, footerTop, FOOTER_WIDTH, 80).fill(gradient);
  const footerText = (lines: readonly string[], offset: number, width: number) =>
    lines.forEach((line, i) => {
      doc.font("Helvetica").fontSize(7).fillColor("#ffffff");
      doc.text(fitLine(line, width * scale, (t) => doc.widthOfString(t)), LEFT + offset * scale, footerTop + 18 + i * 12, {
        width: width * scale,
        lineBreak: false,
      });
    });
  footerText([PFI_COMPANY.name, PFI_COMPANY.email, PFI_COMPANY.website], 22, 180);
  footerText(["PHONE:", ...PFI_COMPANY.phones], 252, 120);
  footerText(["PHYSICAL ADDRESS:", ...PFI_COMPANY.address], 425, 145);

  doc.end();
  return done;
}
