import Link from "next/link";
import {
  STOCK_REPORTING_MODULE_NAV,
  type StockReportingModuleKey,
} from "@/lib/stock-reporting/constants";
import { cn } from "@/lib/utils";
import { ClipboardList, Clock3, Truck } from "lucide-react";
import { DealerHeroActions } from "./dealer-hero-actions";
import { DealerHeroMedia } from "./dealer-hero-media";
import "@/app/dealer/dealer-stock-reporting.css";
import "@/app/dealer/dealer-portal-hero.css";

function moduleIcon(key: StockReportingModuleKey) {
  if (key === "records") return <Clock3 size={18} strokeWidth={2} aria-hidden />;
  if (key === "rtt") return <Truck size={18} strokeWidth={2} aria-hidden />;
  return <ClipboardList size={18} strokeWidth={2} aria-hidden />;
}

export function StockReportingModuleShell({
  module,
  title,
  subtitle,
  kicker = "Dealer Portal",
  children,
}: {
  module: StockReportingModuleKey;
  title: string;
  subtitle: string;
  /** Optional hero kicker above the title (mockup uses STOCK SALE REPORTING on RTT). */
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ssr">
      <section className="ssr__hero" aria-label={title}>
        <DealerHeroMedia />
        <div className="ssr__hero-veil" aria-hidden />
        <div className="ssr__hero-inner">
          <div className="ssr__hero-copy">
            <span className="ssr__hero-accent" aria-hidden />
            <div>
              <p className="ssr__hero-kicker">{kicker}</p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          <DealerHeroActions />
        </div>
      </section>

      <div className="ssr__body">
        <aside className="ssr__nav" aria-label="Stock Sale Reporting modules">
          <ul className="ssr__nav-list">
            {STOCK_REPORTING_MODULE_NAV.map((item) => {
              const active = item.key === module;
              return (
                <li key={item.key} className="ssr__nav-item">
                  <Link
                    href={item.href}
                    className={cn("ssr__nav-link", active && "is-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    {moduleIcon(item.key)}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <div className="ssr__main">{children}</div>
      </div>
    </div>
  );
}
