import { NextResponse } from "next/server";
import { requireDealer } from "@/lib/session";
import { renderStockSaleReportPdf } from "@/lib/stock-reporting/report-pdf";
import { getReportForDealer, StockReportingError } from "@/lib/stock-reporting/service";

function n(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const x = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(x) ? x : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireDealer();
    const { id } = await context.params;
    const report = await getReportForDealer({
      dealerOrganizationId: session.user.dealerOrganizationId!,
      reportId: id,
    });

    if (report.status !== "CLOSED") {
      return NextResponse.json(
        { error: "PDF is only available for closed reports." },
        { status: 400 }
      );
    }
    if (!report.reportReference) {
      return NextResponse.json(
        { error: "This closed report is missing an official reference." },
        { status: 500 }
      );
    }

    const pdf = await renderStockSaleReportPdf({
      reportReference: report.reportReference,
      stationName: report.station.name,
      reportingDate: report.reportingDate,
      closedAt: report.closedAt,
      meterPms: report.meterSalesPmsLitres ?? 0,
      meterAgo: report.meterSalesAgoLitres ?? 0,
      tankPms: report.tankSalesPmsLitres ?? 0,
      tankAgo: report.tankSalesAgoLitres ?? 0,
      varianceTotal: report.wetVarianceTotalLitres,
      wetResolution: report.wetResolution,
      wetState: report.wetState,
      pricePms: n(report.sellingPricePmsKes),
      priceAgo: n(report.sellingPriceAgoKes),
      expectedPms: n(report.expectedPmsKes),
      expectedAgo: n(report.expectedAgoKes),
      expectedTotal: n(report.expectedRevenueKes),
      cash: n(report.cashCollectionsKes),
      mpesa: n(report.mpesaCollectionsKes),
      card: n(report.cardCollectionsKes),
      collectionsTotal: n(report.collectionsKes),
      monetaryDifference: n(report.monetaryDifferenceKes),
      monetaryState: report.monetaryState,
      discrepancyReason: report.monetaryDiscrepancyReason,
      wetLossReason: report.wetLossReason,
    });

    const filename = `${report.reportReference.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof StockReportingError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[stock-reporting] pdf", err);
    return NextResponse.json({ error: "Could not generate the PDF." }, { status: 500 });
  }
}
