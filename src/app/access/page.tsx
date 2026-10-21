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
import { BrandPanel } from "@/components/access/portal-login";
import "@/app/intelligence/login/login.css";

const options = [
  {
    href: "/intelligence/login",
    title: "Trinity Staff",
    description: "Internal platform for Trinity employees.",
    caps: "Retail Interface • Dealer Orders • Messaging",
    icon: Building2,
    tone: "access-card--staff",
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
    tone: "access-card--dealer",
    iconTone: "access-card__icon--blue",
    goTone: "access-card__go--blue",
    image: "/assets2/img/access/dealer-station.jpg",
  },
  {
    href: "/depot/login",
    title: "Depot & Operations",
    description: "Access for depot and logistics personnel.",
    caps: "Loading • Dispatch • Deliveries • Operations",
    icon: Truck,
    tone: "access-card--depot",
    iconTone: "access-card__icon--green",
    goTone: "access-card__go--green",
    image: "/assets2/img/access/depot-tanker.jpg",
  },
];

const trust = [
  { title: "Enterprise Security", subtitle: "256-bit encryption", icon: Shield },
  { title: "Role Based Access", subtitle: "Granular permissions", icon: Users },
  { title: "Audit Logging", subtitle: "Activity monitored", icon: FileText },
];

export default function AccessPage() {
  return (
    <div className="login-shell">
      <BrandPanel
        image="/assets2/img/hero/storage.jpg"
        headline="One connected platform for"
        highlight="Trinity Energy."
        copy="Intelligence, operations and collaboration — powering a smarter, more efficient retail network across East Africa."
        features={[
          { title: "Intelligence", description: "Actionable insights for better decisions.", icon: Building2 },
          { title: "Operations", description: "Seamless workflows from order to delivery.", icon: Fuel },
          { title: "Collaboration", description: "Connected teams across the value chain.", icon: Truck },
        ]}
        statusTitle="System Operational"
        statusSub="East Africa Hub"
        countries={["KENYA", "UGANDA", "TANZANIA", "RWANDA", "SOUTH SUDAN"]}
      />
      <section className="login-panel">
        <div className="login-card-wrap">
          <div className="login-card">
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TrinityLogo variant="dark" height={48} />
              </div>
              <div className="login-secure">
                <Lock className="h-3.5 w-3.5" />
                Secure Access
              </div>
              <h2 className="login-title">Welcome to Trinity Retail Intelligence</h2>
              <p className="login-copy">
                Choose how you’re accessing the platform to continue to your secure login.
              </p>
            </div>

            <div className="access-list">
              {options.map((option) => {
                const Icon = option.icon;
                return (
                  <Link
                    key={option.href}
                    href={option.href}
                    className={`access-card ${option.tone}`}
                  >
                    <span
                      className="access-card__media"
                      style={{ backgroundImage: `url("${option.image}")` }}
                      aria-hidden
                    />
                    <span className={`access-card__icon ${option.iconTone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="access-card__copy">
                      <span className="access-card__title">{option.title}</span>
                      <span className="access-card__desc">{option.description}</span>
                      <span className="access-card__caps">{option.caps}</span>
                    </span>
                    <span className={`access-card__go ${option.goTone}`}>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="login-trust">
              {trust.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="login-trust__item">
                    <div className="login-trust__icon">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="login-trust__title">{item.title}</div>
                    <div className="login-trust__sub">{item.subtitle}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="login-footer">
            <div>© {new Date().getFullYear()} Trinity Energy Limited</div>
            <div style={{ marginTop: "0.25rem" }}>
              Retail Intelligence Platform • Version 1.0
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
