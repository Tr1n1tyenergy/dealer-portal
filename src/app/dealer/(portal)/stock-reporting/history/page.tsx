import { redirect } from "next/navigation";

/** Legacy route — consolidated into Report Records. */
export default async function StockReportingHistoryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ stationId?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.stationId ? `?stationId=${encodeURIComponent(sp.stationId)}` : "";
  redirect(`/dealer/stock-reporting/records${qs}`);
}
