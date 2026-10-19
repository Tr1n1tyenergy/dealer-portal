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

const BLUE = "#3854a3";
const TEAL = "#32c1d1";
const INK = "#1f2937";
const RULE = "#9ca3af";
const DESCRIPTIONS = { PMS: "PMS LOCAL", AGO: "AGO LOCAL" } as const;

// A4 in points; everything is placed explicitly, the template is a fixed one-page form.
const X = 10;
const W = 575;

let logo: Buffer | null | undefined;
function trinityLogo(): Buffer | null {
  if (logo === undefined) {
    try {
      logo = readFileSync(path.join(process.cwd(), "public/assets2/img/logo.png"));
    } catch {
      logo = null;
    }
  }
  return logo;
}

const kenyaDate = (date: Date, style: "long" | "dotted") => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: style === "long" ? "short" : "2-digit", year: "numeric" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return style === "long" ? `${parts.day} ${parts.month} ${parts.year}` : `${parts.day}.${parts.month}.${parts.year}`;
};

/** Shorten text to one line of the given width, ending it with "…" when it had to be cut. */
export function fitLine(text: string, width: number, measure: (text: string) => number): string {
  if (measure(text) <= width) return text;
  let cut = text;
  while (cut.length > 0 && measure(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Draw the PFI as a one-page A4 PDF laid out like Trinity's Odoo pro-forma template. */
export function renderPfiPdf(data: PfiDocument): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Pro-Forma Invoice ${data.number}`, Author: PFI_COMPANY.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const box = (x: number, y: number, w: number, h: number) => doc.lineWidth(0.6).rect(x, y, w, h).stroke(INK);
  const bar = (y: number, h: number, label: string, size: number, align: "center" | "left" = "left") => {
    doc.rect(X, y, W, h).fill(BLUE);
    doc.font("Helvetica-Bold").fontSize(size).fillColor("#ffffff")
      .text(label, X + 8, y + (h - size) / 2 + 1, { width: W - 16, align, lineBreak: false });
  };
  // One line only: anything wider than its column is cut with "…", so it can never wrap into the next row.
  const text = (value: string, x: number, y: number, w: number, opts: PDFKit.Mixins.TextOptions & { bold?: boolean; size?: number; color?: string } = {}) => {
    const { bold, size = 8, color = INK, ...rest } = opts;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
    const line = rest.lineBreak ? value : fitLine(value, w, (t) => doc.widthOfString(t));
    doc.text(line, x, y, { width: w, lineBreak: false, ...rest });
  };

  // Logo
  const logoImage = trinityLogo();
  if (logoImage) doc.image(logoImage, 30, 22, { width: 150 });

  // Title
  let y = 98;
  bar(y, 30, "PRO-FORMA INVOICE", 15, "center");
  y += 30;

  // SO number and date
  const half = 317;
  box(X, y, 90, 20); box(X + 90, y, half - 90, 20); box(X + half, y, 145, 20); box(X + half + 145, y, W - half - 145, 20);
  text("SO No.", X + 5, y + 6, 80);
  text(data.number, X + 95, y + 6, half - 100);
  text("SO DATE:", X + half + 5, y + 6, 135);
  text(kenyaDate(data.soDate, "long"), X + half + 150, y + 6, W - half - 155);
  y += 20;

  // Customer and terms
  const blockH = 78;
  box(X, y, half, blockH); box(X + half, y, W - half, blockH);
  text("CUSTOMER:", X + 5, y + 8, 80, { bold: true });
  text(data.customerName, X + 90, y + 8, half - 98, { lineBreak: true, height: 20, ellipsis: true });
  text("CUSTOMER ID:", X + 5, y + 32, 80, { bold: true });
  text(data.customerId, X + 90, y + 32, half - 98, { ellipsis: true });
  text("ADDRESS:", X + 5, y + 48, 80, { bold: true });
  data.addressLines.slice(0, 2).forEach((line, i) => text(line, X + 90, y + 48 + i * 11, half - 98, { ellipsis: true }));
  const terms: [string, string][] = [
    ["Payment Terms:", PFI_COMPANY.paymentTerms],
    ["Currency", PFI_COMPANY.currency],
    ["Source Location:", data.sourceLocation],
  ];
  terms.forEach(([label, value], i) => {
    text(label, X + half + 5, y + 36 + i * 13, 105, { bold: true });
    text(value, X + half + 120, y + 36 + i * 13, W - half - 125, { ellipsis: true });
  });
  y += blockH;

  // Lines
  const cols = [
    { label: "ITEM\nNO", w: 29, align: "left" as const },
    { label: "DESCRIPTION", w: 132, align: "left" as const },
    { label: "UOM", w: 58, align: "left" as const },
    { label: "VOLUME", w: 91, align: "right" as const },
    { label: "UNIT PRICE", w: 154, align: "right" as const },
    { label: "AMOUNT", w: W - 29 - 132 - 58 - 91 - 154, align: "right" as const },
  ];
  doc.rect(X, y, W, 24).fill(BLUE);
  let cx = X;
  for (const col of cols) {
    doc.font("Helvetica-Bold").fontSize(col.label.includes("\n") ? 7.5 : 8.5).fillColor("#ffffff")
      .text(col.label, cx + 3, y + (col.label.includes("\n") ? 4 : 8), { width: col.w - 6, align: "center" });
    cx += col.w;
  }
  y += 24;
  data.totals.lines.forEach((line, i) => {
    const cells = [String(i + 1), DESCRIPTIONS[line.product], "L", formatVolume(line.quantityLitres), formatMoney(line.unitPriceExVat), formatMoney(line.amount)];
    cx = X;
    cols.forEach((col, c) => {
      box(cx, y, col.w, 16);
      text(cells[c], cx + 4, y + 5, col.w - 8, { align: col.align });
      cx += col.w;
    });
    y += 16;
  });
  const labelW = W - cols[5].w;
  const vatPercent = `${Math.round(Number(data.totals.vatRate) * 100)}%`;
  for (const [label, value] of [["Sub Total", data.totals.subtotal], [`VAT (${vatPercent})`, data.totals.vat], ["Total", data.totals.total]] as const) {
    box(X, y, labelW, 20); box(X + labelW, y, cols[5].w, 20);
    text(label, X, y + 6, labelW, { bold: true, align: "center" });
    text(formatMoney(value), X + labelW + 4, y + 6, cols[5].w - 8, { align: "right", bold: label === "Total" });
    y += 20;
  }
  y += 6;

  // Bank details
  doc.rect(X, y, W, 12).fill(BLUE);
  text("Bank Account Details", X + 6, y + 3, 200, { bold: true, size: 7, color: "#ffffff" });
  y += 12;
  const bankRows: [string, keyof (typeof PFI_BANK_ACCOUNTS)[number]][] = [
    ["Bank:", "bank"], ["Beneficiary:", "beneficiary"], ["Account Number:", "accountNumber"], ["Beneficiary Bank:", "beneficiaryBank"], ["Swift Code:", "swiftCode"],
  ];
  const bankHalf = W / 2;
  bankRows.forEach(([label, key]) => {
    PFI_BANK_ACCOUNTS.forEach((account, a) => {
      const bx = X + a * bankHalf;
      box(bx, y, 85, 12); box(bx + 85, y, bankHalf - 85, 12);
      text(label, bx + 4, y + 3, 80, { bold: true, size: 7 });
      text(account[key], bx + 89, y + 3, bankHalf - 93, { size: 7 });
    });
    y += 12;
  });
  y += 12;

  // Signatures
  const issued = kenyaDate(data.issuedAt, "dotted");
  for (const [label, name] of [["Prepared By:", data.preparedBy], ["Approved By:", data.approvedBy]] as const) {
    text(label, X + 2, y, 200, { bold: true, size: 7.5 });
    text(name, X + 2, y + 18, 230, { size: 8 });
    doc.lineWidth(0.5).moveTo(X + 2, y + 34).lineTo(X + 232, y + 34).stroke(RULE);
    text("Date: ", X + 300, y + 16, 30, { bold: true, size: 7.5 });
    text(issued, X + 322, y + 16, 120, { size: 7.5 });
    doc.lineWidth(0.5).moveTo(X + 300, y + 34).lineTo(X + 518, y + 34).stroke(RULE);
    y += 46;
  }
  y += 4;

  // Terms and conditions (left empty, as on the template)
  bar(y, 26, "Terms and Conditions", 10.5);
  y += 26;
  box(X, y, W, 13);

  // Footer
  const footerY = 716;
  const gradient = doc.linearGradient(X, footerY, X + W, footerY).stop(0, BLUE).stop(1, TEAL);
  doc.rect(X, footerY, W, 80).fill(gradient);
  const footerText = (lines: string[], x: number, w: number) =>
    lines.forEach((line, i) => text(line, x, footerY + 18 + i * 12, w, { size: 7, color: "#ffffff" }));
  footerText([PFI_COMPANY.name, PFI_COMPANY.email, PFI_COMPANY.website], X + 22, 180);
  footerText(["PHONE:", ...PFI_COMPANY.phones], X + 252, 120);
  footerText(["PHYSICAL ADDRESS:", ...PFI_COMPANY.address], X + 425, 145);

  doc.end();
  return done;
}
