/** CSV / Excel (SpreadsheetML) helpers for Report Records exports. */

export type ReportRecordExportRow = {
  reportReference: string;
  reportingDate: string;
  station: string;
  pumps: string | number;
  tanks: string | number;
  meterSalesLitres: number | null;
  tankSalesLitres: number | null;
  stockVarianceLitres: number | null;
  expectedRevenueKes: number | null;
  collectionsKes: number | null;
  monetaryDifferenceKes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
};

const HEADERS = [
  "Report Reference",
  "Reporting Date",
  "Station",
  "Pumps",
  "Tanks",
  "Meter Sales (L)",
  "Tank Sales (L)",
  "Stock Variance (L)",
  "Expected Revenue (KES)",
  "Collections (KES)",
  "Monetary Difference (KES)",
  "Status",
  "Created At",
  "Last Updated",
  "Submitted At",
] as const;

/** Neutralize spreadsheet formula injection on text cells. */
export function sanitizeSpreadsheetText(value: string): string {
  const s = value.trim();
  if (!s) return "";
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

function cellString(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  return sanitizeSpreadsheetText(String(value));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function rowsToCsv(rows: ReportRecordExportRow[]): string {
  const lines = [
    HEADERS.join(","),
    ...rows.map((r) =>
      [
        cellString(r.reportReference),
        cellString(r.reportingDate),
        cellString(r.station),
        cellString(r.pumps),
        cellString(r.tanks),
        cellString(r.meterSalesLitres),
        cellString(r.tankSalesLitres),
        cellString(r.stockVarianceLitres),
        cellString(r.expectedRevenueKes),
        cellString(r.collectionsKes),
        cellString(r.monetaryDifferenceKes),
        cellString(r.status),
        cellString(r.createdAt),
        cellString(r.updatedAt),
        cellString(r.submittedAt),
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel-compatible SpreadsheetML workbook (opens in Excel / Numbers / LibreOffice). */
export function rowsToSpreadsheetMl(rows: ReportRecordExportRow[]): string {
  const headerCells = HEADERS.map(
    (h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`
  ).join("");

  const body = rows
    .map((r) => {
      const cells: { type: "String" | "Number"; value: string }[] = [
        { type: "String", value: cellString(r.reportReference) },
        { type: "String", value: cellString(r.reportingDate) },
        { type: "String", value: cellString(r.station) },
        typeof r.pumps === "number"
          ? { type: "Number", value: String(r.pumps) }
          : { type: "String", value: cellString(r.pumps) },
        typeof r.tanks === "number"
          ? { type: "Number", value: String(r.tanks) }
          : { type: "String", value: cellString(r.tanks) },
        {
          type: r.meterSalesLitres == null ? "String" : "Number",
          value: cellString(r.meterSalesLitres),
        },
        {
          type: r.tankSalesLitres == null ? "String" : "Number",
          value: cellString(r.tankSalesLitres),
        },
        {
          type: r.stockVarianceLitres == null ? "String" : "Number",
          value: cellString(r.stockVarianceLitres),
        },
        {
          type: r.expectedRevenueKes == null ? "String" : "Number",
          value: cellString(r.expectedRevenueKes),
        },
        {
          type: r.collectionsKes == null ? "String" : "Number",
          value: cellString(r.collectionsKes),
        },
        {
          type: r.monetaryDifferenceKes == null ? "String" : "Number",
          value: cellString(r.monetaryDifferenceKes),
        },
        { type: "String", value: cellString(r.status) },
        { type: "String", value: cellString(r.createdAt) },
        { type: "String", value: cellString(r.updatedAt) },
        { type: "String", value: cellString(r.submittedAt) },
      ];
      return `<Row>${cells
        .map((c) => `<Cell><Data ss:Type="${c.type}">${xmlEscape(c.value)}</Data></Cell>`)
        .join("")}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report Records">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function sumNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function decimalToNumber(
  value: { toString(): string } | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}
