import { redirect } from "next/navigation";

/** Legacy route — consolidated into Report Records. */
export default async function StockReportingDownloadsRedirect() {
  redirect("/dealer/stock-reporting/records?status=CLOSED");
}