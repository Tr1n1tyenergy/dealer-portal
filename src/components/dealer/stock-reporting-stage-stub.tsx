import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  STOCK_REPORT_STAGE_META,
  type StockReportStageId,
} from "@/lib/stock-reporting/constants";
import "@/app/dealer/dealer-stock-reporting.css";

export function StockReportingStageStub({ stage }: { stage: StockReportStageId }) {
  const meta = STOCK_REPORT_STAGE_META[stage];
  return (
    <div className="ssr ssr__stub">
      <div className="ssr__stub-card">
        <h1>{meta.label}</h1>
        <p>
          This reporting stage screen will be implemented in a follow-up. The Stock Sale Reporting
          dashboard already tracks progress from persisted report state — a stage becomes complete
          only after validated readings are saved here.
        </p>
        <Link href="/dealer/stock-reporting" className="ssr__btn ssr__btn--ghost">
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
