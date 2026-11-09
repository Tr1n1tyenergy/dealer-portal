import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDealer } from "@/lib/session";
import { StockReportingModuleShell } from "@/components/dealer/stock-reporting-module-shell";
import { formatKesAmount, formatLitres, formatProductVolumes } from "@/lib/stock-reporting/format";
import { formatStockReportDate } from "@/lib/stock-reporting/dates";
import { getReportForDealer, StockReportingError } from "@/lib/stock-reporting/service";

export default async function StockSaleReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await requireDealer();
  const { id } = await params;
  const { submitted } = await searchParams;

  let report;
  try {
    report = await getReportForDealer({
      dealerOrganizationId: session.user.dealerOrganizationId!,
      reportId: id,
    });
  } catch (err) {
    if (err instanceof StockReportingError) notFound();
    throw err;
  }

  const closed = report.status === "CLOSED";
  if (submitted === "1" && closed) {
    redirect(`/dealer/stock-reporting/report/${report.id}/submitted`);
  }

  return (
    <StockReportingModuleShell
      module="records"
      title="Stock Sale Report"
      subtitle={`${report.station.name} · ${formatStockReportDate(report.reportingDate)}`}
    >
      <section className="ssr__card">
        <div className="ssr__recent-head">
          <div>
            <h2 className="ssr__card-title">
              {formatStockReportDate(report.reportingDate)} · {report.station.name}
            </h2>
            <p className="ssr__card-sub">
              Status: {closed ? "Closed" : "Draft"}
              {closed && report.closedAt
                ? ` · Submitted ${report.closedAt.toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}`
                : null}
              {report.reportReference ? ` · ${report.reportReference}` : ` · Ref ${report.id.slice(0, 10)}…`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {closed ? (
              <Link
                href={`/dealer/stock-reporting/report/${report.id}/submitted`}
                className="ssr__recent-link"
              >
                Submitted summary
              </Link>
            ) : null}
            <Link href="/dealer/stock-reporting/records" className="ssr__recent-link">
              ← Report Records
            </Link>
          </div>
        </div>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.85rem 1.25rem",
            margin: 0,
          }}
        >
          {(
            [
              ["Meter sales", formatProductVolumes(report.meterSalesPmsLitres, report.meterSalesAgoLitres)],
              ["Tank sales", formatProductVolumes(report.tankSalesPmsLitres, report.tankSalesAgoLitres)],
              ["Total sales", formatLitres(report.totalSalesLitres)],
              ["Expected revenue", formatKesAmount(report.expectedRevenueKes)],
              ["Collections", formatKesAmount(report.collectionsKes)],
              ["Monetary difference", formatKesAmount(report.monetaryDifferenceKes)],
              ["Monetary state", report.monetaryState],
              ["Wet stock", `${report.wetResolution} · ${report.wetState}`],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="ssr__summary-label">{label}</dt>
              <dd className="ssr__summary-value" style={{ margin: "0.2rem 0 0" }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="ssr__actions" style={{ marginTop: "1.25rem" }}>
          <Link href="/dealer/stock-reporting" className="ssr__btn ssr__btn--ghost">
            Return to Stock Reporting Dashboard
          </Link>
        </div>
      </section>
    </StockReportingModuleShell>
  );
}
