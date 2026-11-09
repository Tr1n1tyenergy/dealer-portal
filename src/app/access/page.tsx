"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  Fuel,
  Lock,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import "./access.css";

const options = [
  {
    href: "/intelligence/login",
    title: "Trinity Staff",
    description: "Internal platform for Trinity employees.",
    caps: "Retail Interface • AI Note Taker • Presentations",
    icon: Building2,
    tone: "tri-access__option--staff",
    iconTone: "",
    goTone: "",
    image: "/assets2/img/access/staff-office.jpg",
  },
  {
    href: "/dealer/login",
    title: "Dealer Portal",
    description: "Secure access for authorised dealers.",
    caps: "Fuel Orders • PFIs & Payments • Order Tracking",
    icon: Fuel,
    tone: "tri-access__option--dealer",
    iconTone: "tri-access__option-icon--blue",
    goTone: "tri-access__option-go--blue",
    image: "/assets2/img/access/dealer-station.jpg",
  },
  {
    href: "/depot/login",
    title: "Depot & Operations",
    description: "Access for depot and logistics personnel.",
    caps: "Loading • Dispatch • Deliveries • Operations",
    icon: Truck,
    tone: "tri-access__option--depot",
    iconTone: "tri-access__option-icon--green",
    goTone: "tri-access__option-go--green",
    image: "/assets2/img/access/depot-tanker.jpg",
  },
] as const;

const trust = [
  { title: "Enterprise Security", icon: Shield },
  { title: "Role Based Access", icon: Users },
  { title: "Audit Logging", icon: FileText },
] as const;

export default function AccessPage() {
  return (
    <div className="tri-access">
      <aside className="tri-access__brand" aria-label="Trinity Retail Intelligence">
        <div
          className="tri-access__brand-bg"
          role="img"
          aria-label="TrinityNRG fuel station at sunset"
        />
        <div className="tri-access__brand-veil" aria-hidden />
        <div className="tri-access__brand-inner">
          <div className="tri-access__brand-top">
            <TrinityLogo variant="dark" height={46} />
            <div className="tri-access__eyebrow">
              <span className="tri-access__eyebrow-line" aria-hidden />
              <span className="tri-access__eyebrow-text">Trinity Retail Intelligence</span>
            </div>
          </div>

          <div className="tri-access__brand-copy">
            <div className="tri-access__kicker">
              <span className="tri-access__eyebrow-line" aria-hidden />
              <span className="tri-access__eyebrow-text">One Connected Ecosystem</span>
            </div>
            <h1 className="tri-access__headline">
              One connected platform
              <br />
              for <span>Trinity Energy.</span>
            </h1>
            <p className="tri-access__lede">
              Intelligence, operations and collaboration — powering a smarter, more
              efficient retail network across East Africa.
            </p>
          </div>
        </div>
      </aside>

      <section className="tri-access__panel">
        <div className="tri-access__card">
          <div className="tri-access__card-head">
            <div className="tri-access__card-logo">
              <TrinityLogo variant="dark" height={48} />
            </div>
            <div className="tri-access__secure">
              <Lock aria-hidden />
              Secure Access
            </div>
            <h2 className="tri-access__title">
              Welcome to Trinity Retail
              <br />
              Intelligence
            </h2>
            <p className="tri-access__copy">
              Choose how you&apos;re accessing the platform to continue to your secure login.
            </p>
          </div>

          <div className="tri-access__list">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <Link
                  key={option.href}
                  href={option.href}
                  className={`tri-access__option ${option.tone}`}
                >
                  <span
                    className="tri-access__option-media"
                    style={{ backgroundImage: `url("${option.image}")` }}
                    aria-hidden
                  />
                  <span className={`tri-access__option-icon ${option.iconTone}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="tri-access__option-copy">
                    <span className="tri-access__option-title">{option.title}</span>
                    <span className="tri-access__option-desc">{option.description}</span>
                    <span className="tri-access__option-caps">{option.caps}</span>
                  </span>
                  <span className={`tri-access__option-go ${option.goTone}`} aria-hidden>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="tri-access__trust">
            {trust.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="tri-access__trust-item">
                  <div className="tri-access__trust-icon">
                    <Icon aria-hidden />
                  </div>
                  <div className="tri-access__trust-title">{item.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
