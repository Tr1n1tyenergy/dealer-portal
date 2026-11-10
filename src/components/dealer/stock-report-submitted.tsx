"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  Eye,
  Fuel,
  Info,
  Layers,
  Loader2,
  PlusCircle,
  Printer,
  Scale,
  Smartphone,
  Wallet,
} from "lucide-react";
import { formatLitresWithUnit } from "@/lib/stock-reporting/pump-calc";
import {
  formatKesFixed,
  formatKesSigned,
  formatKesWithCurrency,
} from "@/lib/stock-reporting/monetary-calc";
import { wetResolutionLabel } from "@/lib/stock-reporting/reference";
import { cn } from "@/lib/utils";
import { StockReportingSubmittedShell } from "./stock-reporting-submitted-shell";

export function StockReportSubmittedView({
  reportId,
  reportReference,
  stationName,
  reportingDateLabel,
  pumpsLabel,
  tanksLabel,
  stageStatuses,
  meterPms,
  meterAgo,
  tankPms,
  tankAgo,
  varianceTotal,
  wetResolution,
  wetState,
  pricePms,
  priceAgo,
  expectedPms,
  expectedAgo,
  expectedTotal,
  cash,
  mpesa,
  card,
  collectionsTotal,
  monetaryDifference,
  monetaryState,
  newReportBlockedMessage,
}: {
  reportId: string;
  reportReference: string;
  stationName: string;
  reportingDateLabel: string;
  pumpsLabel: string;
  tanksLabel: string;
  stageStatuses: [string, string, string, string];
  meterPms: number;
  meterAgo: number;
  tankPms: number;
  tankAgo: number;
  varianceTotal: number | null;
  wetResolution: string;
  wetState: string;
  pricePms: number | null;
  priceAgo: number | null;
  expectedPms: number | null;
  expectedAgo: number | null;
  expectedTotal: number | null;
  cash: number | null;
  mpesa: number | null;
  card: number | null;
  collectionsTotal: number | null;
  monetaryDifference: number | null;
  monetaryState: string;
  newReportBlockedMessage: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const resolution = wetResolutionLabel(wetResolution, wetState);
  const meterTotal = meterPms + meterAgo;
  const tankTotal = tankPms + tankAgo;
  const monetaryBalanced = monetaryState === "BALANCED";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(t);
    }
  }, []);

  function handlePrint() {
    window.print();
  }

  function handleNewReport() {
    setError(null);
    if (newReportBlockedMessage) {
      setError(newReportBlockedMessage);
      return;
    }
    startTransition(() => {
      router.push("/dealer/stock-reporting");
      router.refresh();
    });
  }

  return (
    <StockReportingSubmittedShell stationName={stationName} stageStatuses={stageStatuses}>
      <div className="ssw__success-banner" role="status">
        <div className="ssw__success-main">
          <span className="ssw__success-check" aria-hidden>
            <Check size={28} strokeWidth={3} />
          </span>
          <div>
            <h2>Daily report submitted successfully</h2>
            <p>
              The {stationName} Station report for <strong>{reportingDateLabel}</strong> has been
              received and is now closed.
            </p>
          </div>
        </div>
        <div className="ssw__success-ref">
          <div className="ssw__success-ref-card">
            <Layers size={18} strokeWidth={2.25} aria-hidden />
            <div>
              <p className="ssw__meta-label">Report reference</p>
              <p className="ssw__success-ref-code">{reportReference}</p>
            </div>
            <span className="ssw__closed-pill">
              <Check size={12} strokeWidth={2.75} aria-hidden />
              Closed
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="ssw__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ssw__meta" aria-label="Report summary">
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <CalendarDays size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Reporting date</p>
            <p className="ssw__meta-value">{reportingDateLabel}</p>
          </div>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Building2 size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Station</p>
            <p className="ssw__meta-value">{stationName}</p>
          </div>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Fuel size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Pumps</p>
            <p className="ssw__meta-value">{pumpsLabel}</p>
          </div>
        </article>
        <article className="ssw__meta-card">
          <span className="ssw__meta-icon">
            <Layers size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="ssw__meta-label">Tanks</p>
            <p className="ssw__meta-value">{tanksLabel}</p>
          </div>
        </article>
      </div>

      <div className="ssw__submit-grid" aria-label="Stock and sales summary">
        <article className="ssw__submit-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Fuel size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h3>Meter sales (dispensers)</h3>
          </div>
          <dl className="ssw__submit-rows">
            <div>
              <dt>PMS sales</dt>
              <dd>{formatLitresWithUnit(meterPms)}</dd>
            </div>
            <div>
              <dt>AGO sales</dt>
              <dd>{formatLitresWithUnit(meterAgo)}</dd>
            </div>
          </dl>
          <div className="ssw__submit-total">
            <span>Total meter sales</span>
            <strong>{formatLitresWithUnit(meterTotal)}</strong>
          </div>
        </article>

        <article className="ssw__submit-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Layers size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h3>Tank stock sales (dips)</h3>
          </div>
          <dl className="ssw__submit-rows">
            <div>
              <dt>PMS tank sales</dt>
              <dd>{formatLitresWithUnit(tankPms)}</dd>
            </div>
            <div>
              <dt>AGO tank sales</dt>
              <dd>{formatLitresWithUnit(tankAgo)}</dd>
            </div>
          </dl>
          <div className="ssw__submit-total">
            <span>Total tank sales</span>
            <strong>{formatLitresWithUnit(tankTotal)}</strong>
          </div>
        </article>

        <article className="ssw__submit-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon ssw__compare-icon--var">
              <Scale size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h3>Stock reconciliation</h3>
          </div>
          <dl className="ssw__submit-rows">
            <div>
              <dt>Variance (meter − tank)</dt>
              <dd>
                {varianceTotal == null ? "—" : formatLitresWithUnit(Math.abs(varianceTotal))}
              </dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>
                <span className="ssw__resolution-pill">{resolution}</span>
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="ssw__submit-grid" aria-label="Monetary summary">
        <article className="ssw__submit-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon">
              <Layers size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h3>Expected revenue (from meter sales)</h3>
          </div>
          <dl className="ssw__submit-rows">
            <div>
              <dt>
                PMS ({formatLitresWithUnit(meterPms)} × KES{" "}
                {pricePms == null ? "—" : formatKesFixed(pricePms)})
              </dt>
              <dd>{formatKesWithCurrency(expectedPms)}</dd>
            </div>
            <div>
              <dt>
                AGO ({formatLitresWithUnit(meterAgo)} × KES{" "}
                {priceAgo == null ? "—" : formatKesFixed(priceAgo)})
              </dt>
              <dd>{formatKesWithCurrency(expectedAgo)}</dd>
            </div>
          </dl>
          <div className="ssw__submit-total ssw__submit-total--yellow">
            <span>Total expected sales</span>
            <strong>{formatKesWithCurrency(expectedTotal)}</strong>
          </div>
        </article>

        <article className="ssw__submit-card">
          <div className="ssw__compare-head">
            <span className="ssw__compare-icon ssw__compare-icon--var">
              <Wallet size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h3>Actual collections</h3>
          </div>
          <div className="ssw__collect-cols">
            <div>
              <span className="ssw__collect-mini-ico">
                <Banknote size={14} strokeWidth={2.25} aria-hidden />
              </span>
              <p>Cash</p>
              <strong>{formatKesWithCurrency(cash)}</strong>
            </div>
            <div>
              <span className="ssw__collect-mini-ico ssw__collect-mini-ico--mpesa">
                <Smartphone size={14} strokeWidth={2.25} aria-hidden />
              </span>
              <p>M-Pesa</p>
              <strong>{formatKesWithCurrency(mpesa)}</strong>
            </div>
            <div>
              <span className="ssw__collect-mini-ico">
                <CreditCard size={14} strokeWidth={2.25} aria-hidden />
              </span>
              <p>Visa / card</p>
              <strong>{formatKesWithCurrency(card)}</strong>
            </div>
          </div>
          <div className="ssw__submit-total ssw__submit-total--yellow">
            <span>Total collections</span>
            <strong>{formatKesWithCurrency(collectionsTotal)}</strong>
          </div>
        </article>

        <article
          className={cn(
            "ssw__submit-card ssw__submit-card--money",
            monetaryBalanced ? "is-balanced" : "is-open"
          )}
        >
          <div className="ssw__money-result">
            <span className="ssw__money-result-check" aria-hidden>
              <Check size={22} strokeWidth={2.75} />
            </span>
            <p className="ssw__meta-label">Monetary reconciliation</p>
            <strong>{monetaryBalanced ? "Balanced" : monetaryState}</strong>
            <p>
              Difference:{" "}
              {monetaryDifference == null
                ? "—"
                : formatKesSigned(monetaryDifference)}
            </p>
          </div>
        </article>
      </div>

      <div className="ssw__submit-footer print:hidden">
        <div className="ssw__next-step">
          <span className="ssw__next-step-ico" aria-hidden>
            <Info size={16} strokeWidth={2.25} />
          </span>
          <div>
            <strong>Next step</strong>
            <p>You can view, download or print this report from Report Records.</p>
          </div>
        </div>
        <div className="ssw__submit-actions">
          <Link href={`/dealer/stock-reporting/report/${reportId}`} className="ssw__btn ssw__btn--ghost">
            <Eye size={16} strokeWidth={2.25} aria-hidden />
            View report
          </Link>
          <a
            href={`/api/stock-reporting/reports/${reportId}/pdf`}
            className="ssw__btn ssw__btn--ghost"
          >
            <Download size={16} strokeWidth={2.25} aria-hidden />
            Download (PDF)
          </a>
          <button type="button" className="ssw__btn ssw__btn--ghost" onClick={handlePrint}>
            <Printer size={16} strokeWidth={2.25} aria-hidden />
            Print
          </button>
          <button
            type="button"
            className="ssw__btn ssw__btn--primary"
            disabled={pending}
            onClick={handleNewReport}
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : (
              <PlusCircle size={16} strokeWidth={2.25} aria-hidden />
            )}
            New Daily Report
          </button>
        </div>
      </div>
    </StockReportingSubmittedShell>
  );
}
