"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Droplets,
  FileWarning,
  Layers,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import "@/app/intelligence/retail/staff-home.css";

export type StaffHomeKpi = {
  key: string;
  label: string;
  value: string;
  meta: string;
  metaTone?: "up" | "muted";
  href: string;
  tone: "blue" | "gold" | "purple";
  icon: "layers" | "wallet" | "truck" | "users";
};

export type StaffHomeTask = {
  key: string;
  title: string;
  description: string;
  badge: string;
  badgeTone: "pending" | "overdue" | "due";
  actionLabel: string;
  actionHref: string;
  actionVariant: "yellow" | "outline";
  icon: "coins" | "report" | "tag";
};

export type StaffHomeActivity = {
  id: string;
  text: string;
  timeLabel: string;
  href: string | null;
  tone: "ok" | "info";
  icon: "check" | "doc" | "truck";
};

export type StaffHomeRank = {
  name: string;
  valueLabel: string;
  pct: number;
};

export type StaffHomeProps = {
  greeting: string;
  displayName: string;
  kpis: StaffHomeKpi[];
  tasks: StaffHomeTask[];
  activity: StaffHomeActivity[];
  salesRanks: StaffHomeRank[];
  lossRanks: StaffHomeRank[];
  epra: {
    effectiveLabel: string;
    targetMs: number;
    hasUpcoming: boolean;
  };
};

const kpiIcons = {
  layers: Layers,
  wallet: Wallet,
  truck: Truck,
  users: Users,
} as const;

const taskIcons = {
  coins: CircleDollarSign,
  report: FileWarning,
  tag: Tag,
} as const;

function Countdown({ targetMs, hasUpcoming }: { targetMs: number; hasUpcoming: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasUpcoming) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [hasUpcoming]);

  if (!hasUpcoming) {
    return <p className="sh-empty">No upcoming EPRA price change is configured.</p>;
  }

  const remaining = Math.max(0, targetMs - now);
  const totalMin = Math.floor(remaining / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="sh-countdown" aria-live="polite">
      <div className="sh-countdown__cell">
        <span className="sh-countdown__n">{pad(days)}</span>
        <span className="sh-countdown__l">Days</span>
      </div>
      <div className="sh-countdown__cell">
        <span className="sh-countdown__n">{pad(hours)}</span>
        <span className="sh-countdown__l">Hours</span>
      </div>
      <div className="sh-countdown__cell">
        <span className="sh-countdown__n">{pad(minutes)}</span>
        <span className="sh-countdown__l">Minutes</span>
      </div>
    </div>
  );
}

export function StaffHomeDashboard(props: StaffHomeProps) {
  return (
    <div className="sh">
      <section className="sh-hero" aria-label="Staff Portal hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sh-hero__img"
          src="/assets2/img/access/trinitynrg-forecourt-at-sunset.png?v=5"
          alt=""
        />
        <div className="sh-hero__veil" aria-hidden />
        <div className="sh-hero__copy">
          <span className="sh-hero__accent" aria-hidden />
          <div>
            <p className="sh-hero__kicker">Staff Portal</p>
            <h1 className="sh-hero__title">
              {props.greeting}, {props.displayName}
            </h1>
            <p className="sh-hero__sub">
              Here&apos;s what&apos;s happening across the retail network today.
            </p>
          </div>
        </div>
      </section>

      <div className="sh-wrap">
        <section className="sh-kpis" aria-label="Operational KPIs">
          {props.kpis.map((k) => {
            const Icon = kpiIcons[k.icon];
            return (
              <Link key={k.key} href={k.href} className="sh-kpi">
                <span className={`sh-kpi__icon sh-kpi__icon--${k.tone}`} aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <div className="sh-kpi__body">
                  <div className="sh-kpi__label-row">
                    <div className="sh-kpi__label">{k.label}</div>
                    <ChevronRight className="sh-kpi__go" size={15} aria-hidden />
                  </div>
                  <div className="sh-kpi__value">{k.value}</div>
                  <div
                    className={
                      k.metaTone === "up" ? "sh-kpi__meta sh-kpi__meta--up" : "sh-kpi__meta"
                    }
                  >
                    {k.meta}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="sh-ops" aria-label="Operational dashboard">
          <article className="sh-panel">
            <header className="sh-panel__head">
              <div className="sh-panel__title-row">
                <span className="sh-panel__ico sh-panel__ico--warn" aria-hidden>
                  <AlertCircle size={18} strokeWidth={2} />
                </span>
                <div>
                  <h2 className="sh-panel__title">Needs Action</h2>
                  <p className="sh-panel__sub">Key items requiring your attention.</p>
                </div>
              </div>
              <Link href="/intelligence/retail/orders?stage=verification" className="sh-panel__link">
                View all tasks →
              </Link>
            </header>

            {props.tasks.length === 0 ? (
              <p className="sh-empty">No outstanding action items right now.</p>
            ) : (
              props.tasks.map((t) => {
                const Icon = taskIcons[t.icon];
                return (
                  <div key={t.key} className="sh-task">
                    <span className="sh-task__ico" aria-hidden>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <h3 className="sh-task__title">{t.title}</h3>
                      <p className="sh-task__desc">{t.description}</p>
                    </div>
                    <div className="sh-task__side">
                      <span className={`sh-badge sh-badge--${t.badgeTone}`}>{t.badge}</span>
                      <Link
                        href={t.actionHref}
                        className={`sh-btn sh-btn--${t.actionVariant}`}
                      >
                        {t.actionLabel}
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </article>

          <article className="sh-panel">
            <header className="sh-panel__head">
              <div className="sh-panel__title-row">
                <span className="sh-panel__ico sh-panel__ico--live" aria-hidden>
                  <Activity size={18} strokeWidth={2} />
                </span>
                <div>
                  <h2 className="sh-panel__title">Currently Ongoing</h2>
                  <p className="sh-panel__sub">
                    Live updates across orders, payments and reporting.
                  </p>
                </div>
              </div>
              <Link href="/intelligence/admin/activity" className="sh-panel__link">
                View all activity →
              </Link>
            </header>

            {props.activity.length === 0 ? (
              <p className="sh-empty">No recent activity yet.</p>
            ) : (
              <ul className="sh-feed">
                {props.activity.map((a) => {
                  const inner = (
                    <>
                      <span
                        className={
                          a.tone === "ok" ? "sh-feed__icon sh-feed__icon--ok" : "sh-feed__icon"
                        }
                        aria-hidden
                      >
                        {a.icon === "check" ? (
                          <CheckCircle2 size={14} />
                        ) : a.icon === "truck" ? (
                          <Truck size={14} />
                        ) : (
                          <ClipboardList size={14} />
                        )}
                      </span>
                      <p className="sh-feed__text">{a.text}</p>
                      <span className="sh-feed__time">{a.timeLabel}</span>
                    </>
                  );
                  return (
                    <li key={a.id}>
                      {a.href ? (
                        <Link href={a.href} className="sh-feed__item">
                          {inner}
                        </Link>
                      ) : (
                        <div className="sh-feed__item">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </section>

        <section className="sh-intel" aria-label="Business intelligence">
          <article className="sh-card">
            <header className="sh-card__head">
              <h2 className="sh-card__title">
                <BarChart3 size={16} strokeWidth={2.2} aria-hidden />
                Sales per Station <span className="sh-card__period">(This Month)</span>
              </h2>
              <Link href="/intelligence/retail/analytics" className="sh-panel__link">
                View full report →
              </Link>
            </header>
            {props.salesRanks.length === 0 ? (
              <p className="sh-empty">No closed sale reports this month yet.</p>
            ) : (
              <ol className="sh-rank">
                {props.salesRanks.map((r, i) => (
                  <li key={r.name} className="sh-rank__row">
                    <span className="sh-rank__n">{i + 1}</span>
                    <div>
                      <div className="sh-rank__top">
                        <span className="sh-rank__name">{r.name}</span>
                        <span className="sh-rank__val">{r.valueLabel}</span>
                      </div>
                      <div className="sh-rank__bar" aria-hidden>
                        <div className="sh-rank__fill" style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="sh-card">
            <header className="sh-card__head">
              <h2 className="sh-card__title">
                <Droplets size={16} strokeWidth={2.2} aria-hidden />
                Losses per Station <span className="sh-card__period">(This Month)</span>
              </h2>
              <Link href="/intelligence/retail/analytics" className="sh-panel__link">
                View full report →
              </Link>
            </header>
            {props.lossRanks.length === 0 ? (
              <p className="sh-empty">No recorded wet-stock losses this month.</p>
            ) : (
              <ol className="sh-rank">
                {props.lossRanks.map((r, i) => (
                  <li key={r.name} className="sh-rank__row">
                    <span className="sh-rank__n">{i + 1}</span>
                    <div>
                      <div className="sh-rank__top">
                        <span className="sh-rank__name">{r.name}</span>
                        <span className="sh-rank__val">{r.valueLabel}</span>
                      </div>
                      <div className="sh-rank__bar" aria-hidden>
                        <div className="sh-rank__fill" style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="sh-card sh-card--epra">
            <span className="sh-epra__ico" aria-hidden>
              <CalendarDays size={18} strokeWidth={2} />
            </span>
            <h2 className="sh-epra__title">EPRA Price Change</h2>
            <p className="sh-epra__desc">
              {props.epra.hasUpcoming
                ? `New prices take effect on ${props.epra.effectiveLabel} (from 00:00 hrs).`
                : "EPRA schedule will appear here when the next change date is known."}
            </p>
            <Countdown targetMs={props.epra.targetMs} hasUpcoming={props.epra.hasUpcoming} />
            <svg className="sh-epra__wave" viewBox="0 0 220 90" aria-hidden>
              <path
                d="M0 55 C40 20 70 70 110 42 C150 18 180 62 220 40 L220 90 L0 90 Z"
                fill="rgba(255,204,0,0.28)"
              />
              <path
                d="M0 68 C45 40 80 78 120 55 C155 38 185 72 220 58 L220 90 L0 90 Z"
                fill="rgba(255,204,0,0.18)"
              />
            </svg>
          </article>
        </section>
      </div>
    </div>
  );
}
