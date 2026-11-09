import { Check, FileCheck2 } from "lucide-react";
import { dealerHeroPhotoStyle } from "@/lib/dealer/hero";
import { STOCK_REPORT_WIZARD_STAGES } from "@/lib/stock-reporting/constants";
import { DealerHeroActions } from "./dealer-hero-actions";
import "@/app/dealer/dealer-stock-wizard.css";

export function StockReportingSubmittedShell({
  stationName,
  stageStatuses,
  children,
}: {
  stationName: string;
  stageStatuses: [string, string, string, string];
  children: React.ReactNode;
}) {
  return (
    <div className="ssw ssw--submitted">
      <section className="ssw__hero" style={dealerHeroPhotoStyle} aria-label="Daily report submitted">
        <div className="ssw__hero-veil" aria-hidden />
        <div className="ssw__hero-inner">
          <div className="ssw__hero-copy">
            <span className="ssw__hero-accent" aria-hidden />
            <div>
              <p className="ssw__hero-kicker">Stock Sale Reporting</p>
              <h1>Daily Report Submitted</h1>
              <p>
                Your daily stock, sales and monetary reconciliation has been successfully submitted.
              </p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <div className="ssw__body">
        <aside className="ssw__aside" aria-label="Reporting stages completed">
          <ol className="ssw__steps ssw__steps--done">
            {STOCK_REPORT_WIZARD_STAGES.map((stage, index) => (
              <li key={stage.id} className="ssw__step">
                {index < STOCK_REPORT_WIZARD_STAGES.length - 1 ? (
                  <span className="ssw__step-rail" aria-hidden />
                ) : null}
                <div className="ssw__step-link is-done ssw__step-static">
                  <span className="ssw__step-num" aria-hidden>
                    <Check size={14} strokeWidth={2.75} />
                  </span>
                  <span className="ssw__step-copy">
                    <span className="ssw__step-label">{stage.label}</span>
                    <span className="ssw__step-sub">{stageStatuses[index]}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="ssw__submitted-flag">
            <span className="ssw__submitted-flag-ico" aria-hidden>
              <FileCheck2 size={18} strokeWidth={2.25} />
            </span>
            <strong>Report Submitted</strong>
          </div>

        </aside>

        <div className="ssw__panel">{children}</div>
      </div>
    </div>
  );
}
