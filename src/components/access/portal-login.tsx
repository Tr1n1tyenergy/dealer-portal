"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { cn } from "@/lib/utils";
import "@/app/intelligence/login/login.css";
import { loginErrorMessage } from "@/lib/security/login-errors";

export function BrandPanel({
  image,
  headline,
  highlight,
  copy,
  features,
  statusTitle,
  statusSub,
  countries,
}: {
  image: string;
  headline: string;
  highlight: string;
  copy: string;
  features: { title: string; description: string; icon: React.ComponentType<{ className?: string }> }[];
  statusTitle: string;
  statusSub: string;
  countries?: string[];
}) {
  return (
    <aside className="login-brand">
      <div className="login-brand__bg" style={{ backgroundImage: `url("${image}")` }} />
      <div className="login-brand__veil" />
      <div className="login-brand__grid" />
      <div className="login-brand__content">
        <div>
          <TrinityLogo variant="light" height={48} />
          <div className="login-eyebrow">
            <div className="login-eyebrow__line" />
            <div className="login-eyebrow__text">Trinity Retail Intelligence</div>
          </div>
        </div>
        <div>
          <h1 className="login-headline">
            {headline} <span>{highlight}</span>
          </h1>
          <p className="login-subcopy">{copy}</p>
          <div className="login-features">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="login-feature">
                  <div className="login-feature__icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="login-feature__title">{feature.title}</div>
                  <div className="login-feature__desc">{feature.description}</div>
                </div>
              );
            })}
          </div>
          {countries ? (
            <div className="login-countries">
              {countries.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="login-status">
          <span className="login-status__dot" />
          <div>
            <div className="login-status__title">{statusTitle}</div>
            <div className="login-status__sub">{statusSub}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function PortalLogin({
  portal,
  badge,
  badgeTone,
  title,
  description,
  button,
  destination,
  support,
  trust,
  brand,
}: {
  portal: "dealer" | "depot";
  badge: string;
  badgeTone?: "blue" | "green";
  title: string;
  description: string;
  button: string;
  destination: string;
  support: string;
  trust: { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[];
  brand: React.ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, portal, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(loginErrorMessage(result.error, "Invalid credentials, or this account is not provisioned for this portal."));
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="login-shell">
      {brand}
      <section className="login-panel">
        <div className="login-card-wrap">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="login-card">
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TrinityLogo variant="dark" height={48} />
              </div>
              <div className={cn("login-badge", badgeTone === "green" && "login-badge--green")}>{badge}</div>
              <h2 className="login-title">{title}</h2>
              <p className="login-copy">{description}</p>
              <Link href="/access" className="login-back">
                Back to access options
              </Link>
            </div>
            <form onSubmit={onSubmit} style={{ marginTop: "1.4rem" }}>
              <div className="login-field">
                <label htmlFor="email">Email Address</label>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" />
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.ke" className="login-input" />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" />
                  <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="login-input" />
                  <button type="button" className="login-input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="login-row">
                <button type="button" className="login-remember" onClick={() => setRemember((v) => !v)}>
                  <span className={cn("login-check", remember && "is-on")}>{remember ? "✓" : ""}</span>
                  Remember me
                </button>
                <Link href="/intelligence/forgot-password" className="login-forgot">Forgot Password?</Link>
              </div>
              {error ? <div className="login-error">{error}</div> : null}
              <button type="submit" className="login-submit" disabled={loading}>
                <span className="login-submit__label">{loading ? "Signing in..." : button}</span>
                <span className="login-submit__arrow"><ArrowRight className="h-3.5 w-3.5" /></span>
              </button>
            </form>
            <a className="login-support" href="mailto:support@trinityenergyltd.com">
              <div>
                <strong>Contact Trinity Support</strong>
                <span>{support}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </a>
            <div className="login-trust">
              {trust.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="login-trust__item">
                    <div className="login-trust__icon"><Icon className="h-3.5 w-3.5" /></div>
                    <div className="login-trust__title">{item.title}</div>
                    <div className="login-trust__sub">{item.subtitle}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
          <div className="login-footer">
            <div>© {new Date().getFullYear()} Trinity Energy Limited</div>
            <div style={{ marginTop: "0.25rem" }}>Retail Intelligence Platform • Version 1.0</div>
          </div>
        </div>
      </section>
    </div>
  );
}
