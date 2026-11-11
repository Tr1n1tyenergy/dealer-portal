import { NextResponse } from "next/server";
import { canUser } from "@/lib/permissions";
import { requireInternalApi } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { sanitizeSpreadsheetText } from "@/lib/stock-reporting/records-export";
import {
  aggregateStaffReconciliation,
  defaultStaffReportDate,
  formatSignedLitres,
  formatVariancePct,
  parseIsoDateParam,
  resolvePeriodBounds,
  toIsoDateParam,
  type StaffReportingPeriod,
} from "@/lib/stock-reporting/staff-reconciliation";
import {
  aggregateStaffMonetary,
  formatKshCompact,
  paymentMethodSlices,
} from "@/lib/stock-reporting/staff-monetary-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): StaffReportingPeriod {
  if (raw === "week" || raw === "month" || raw === "year" || raw === "custom" || raw === "day") {
    return raw;
  }
  return "day";
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return sanitizeSpreadsheetText(String(value));
}

export async function GET(req: Request) {
  const auth = await requireInternalApi();
  if ("error" in auth) return auth.error;
  if (!canUser(auth.session.user, "analytics", "view") && !canUser(auth.session.user, "orders", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();
  const period = parsePeriod(url.searchParams.get("period"));
  const date = parseIsoDateParam(url.searchParams.get("date")) ?? defaultStaffReportDate();
  const from = parseIsoDateParam(url.searchParams.get("from")) ?? date;
  const to = parseIsoDateParam(url.searchParams.get("to")) ?? date;
  const bounds = resolvePeriodBounds({ period, date, from, to });
  const stationId = url.searchParams.get("station");

  if (!stationId) {
    return NextResponse.json({ error: "station is required" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: {
      id: true,
      name: true,
      tradingName: true,
      dealerOrganization: { select: { name: true } },
    },
  });
  if (!station) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }

  const section = url.searchParams.get("section") || "reconciliation";
  const stationName = station.tradingName || station.name;
  const stamp = toIsoDateParam(defaultStaffReportDate());

  const reports = await prisma.stockSaleReport.findMany({
    where: {
      stationId,
      reportingDate: { gte: bounds.start, lt: bounds.endExclusive },
      status: "CLOSED",
    },
    include: {
      tankReadings: { select: { product: true, openingLitres: true, closingLitres: true } },
      pumpReadings: { select: { product: true, salesLitres: true } },
    },
    orderBy: { reportingDate: "asc" },
  });

  let baseName = `stock-reconciliation-${stationName.replace(/\s+/g, "-").toLowerCase()}-${stamp}`;
  let headerMeta: string[][] = [];
  let tableHeaders: string[] = [];
  let tableRows: (string | number)[][] = [];
  let pdfTitle = "Stock Reconciliation Summary";

  if (section === "monetary") {
    const asNum = (v: { toString(): string } | number | null | undefined) => {
      if (v == null) return null;
      const n = typeof v === "number" ? v : Number(v.toString());
      return Number.isFinite(n) ? n : null;
    };
    const monetary = aggregateStaffMonetary(
      reports.map((r) => ({
        reportingDate: r.reportingDate,
        status: r.status,
        meterSalesPmsLitres: r.meterSalesPmsLitres,
        meterSalesAgoLitres: r.meterSalesAgoLitres,
        sellingPricePmsKes: asNum(r.sellingPricePmsKes),
        sellingPriceAgoKes: asNum(r.sellingPriceAgoKes),
        expectedPmsKes: asNum(r.expectedPmsKes),
        expectedAgoKes: asNum(r.expectedAgoKes),
        expectedRevenueKes: asNum(r.expectedRevenueKes),
        cashCollectionsKes: asNum(r.cashCollectionsKes),
        mpesaCollectionsKes: asNum(r.mpesaCollectionsKes),
        cardCollectionsKes: asNum(r.cardCollectionsKes),
        collectionsKes: asNum(r.collectionsKes),
        monetaryDifferenceKes: asNum(r.monetaryDifferenceKes),
        monetaryDiscrepancyReason: r.monetaryDiscrepancyReason,
      }))
    );
    const payments = paymentMethodSlices(monetary);
    baseName = `monetary-sales-${stationName.replace(/\s+/g, "-").toLowerCase()}-${stamp}`;
    pdfTitle = "Monetary Sales Summary";
    headerMeta = [
      ["Report", "Monetary Sales Summary"],
      ["Station", stationName],
      ["Dealer", station.dealerOrganization.name],
      ["Period", bounds.label],
      ["Generated", new Date().toISOString()],
      ["CLOSED reports included", String(reports.length)],
      ["Total revenue", formatKshCompact(monetary.totalRevenueKes)],
      ["Total collections", formatKshCompact(monetary.totalCollectionsKes)],
      ["Monetary variance", formatKshCompact(monetary.monetaryVarianceKes)],
    ];
    tableHeaders = ["Product", "Sales Volume (L)", "Unit/Avg Price (KSh/L)", "Revenue (KSh)"];
    tableRows = [
      [
        "PMS",
        monetary.pms.volumeLitres,
        monetary.pms.multiPrice
          ? `Avg ${monetary.pms.weightedAveragePrice}`
          : monetary.pms.unitPrice ?? "",
        monetary.pms.revenueKes,
      ],
      [
        "AGO",
        monetary.ago.volumeLitres,
        monetary.ago.multiPrice
          ? `Avg ${monetary.ago.weightedAveragePrice}`
          : monetary.ago.unitPrice ?? "",
        monetary.ago.revenueKes,
      ],
      ["Total", monetary.totalVolume, "", monetary.totalRevenueKes],
      [],
      ["Payment method", "Amount (KSh)", "Share %", ""],
      ...payments.map((p) => [p.label, p.amountKes, p.pct.toFixed(1), ""]),
    ];
    await logActivity({
      actorId: auth.session.user.id,
      action: "STAFF_MONETARY_SALES_EXPORT",
      entity: "Station",
      entityId: stationId,
      meta: { format, period, label: bounds.label, reports: reports.length },
    });
  } else {
    const summary = aggregateStaffReconciliation(
      reports.map((r) => ({
        reportingDate: r.reportingDate,
        status: r.status,
        meterSalesPmsLitres: r.meterSalesPmsLitres,
        meterSalesAgoLitres: r.meterSalesAgoLitres,
        tankReadings: r.tankReadings,
        pumpReadings: r.pumpReadings,
      }))
    );
    headerMeta = [
      ["Report", "Stock Reconciliation Summary"],
      ["Station", stationName],
      ["Dealer", station.dealerOrganization.name],
      ["Period", bounds.label],
      ["Generated", new Date().toISOString()],
      ["CLOSED reports included", String(reports.length)],
      ["Note", "Received/Purchases is 0 until delivery receipts are linked"],
    ];
    tableHeaders = [
      "Product",
      "Opening Stock (L)",
      "Received / Purchases (L)",
      "Stock Available for Sale (L)",
      "Cumulative Sales (L)",
      "Expected Closing Stock (L)",
      "Actual Closing Stock (L)",
      "Variance (L)",
      "Variance (%)",
    ];
    tableRows = [...summary.rows, summary.total].map((row, idx) => [
      idx === summary.rows.length ? "Total" : row.product,
      row.opening,
      row.received,
      row.available,
      row.sales,
      row.expectedClosing,
      row.actualClosing,
      formatSignedLitres(row.variance),
      formatVariancePct(row.variancePct),
    ]);
    await logActivity({
      actorId: auth.session.user.id,
      action: "STAFF_STOCK_RECON_EXPORT",
      entity: "Station",
      entityId: stationId,
      meta: { format, period, label: bounds.label, reports: reports.length },
    });
  }

  if (format === "pdf") {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    doc.fontSize(16).text(pdfTitle, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const [k, v] of headerMeta) doc.text(`${k}: ${v}`);
    doc.moveDown();
    for (const row of tableRows) {
      doc.text(row.map(String).join(" | "));
    }
    doc.end();
    const buf = await done;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  if (format === "xlsx" || format === "xls") {
    const escapeXml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const sheetRows = [
      ...headerMeta.map(([k, v]) => [k, v]),
      [],
      tableHeaders,
      ...tableRows.map((r) => r.map(String)),
    ];
    const xmlRows = sheetRows
      .map((cols) => {
        const cells = cols
          .map((c) => `<Cell><Data ss:Type="String">${escapeXml(cell(c))}</Data></Cell>`)
          .join("");
        return `<Row>${cells}</Row>`;
      })
      .join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Summary"><Table>${xmlRows}</Table></Worksheet>
</Workbook>`;
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.xls"`,
      },
    });
  }

  // default CSV
  const lines = [
    ...headerMeta.map(([k, v]) => `${csvEscape(k)},${csvEscape(String(v))}`),
    "",
    tableHeaders.map(csvEscape).join(","),
    ...tableRows.map((r) => r.map((c) => csvEscape(cell(c))).join(",")),
  ];
  const body = `\uFEFF${lines.join("\n")}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  });
}
