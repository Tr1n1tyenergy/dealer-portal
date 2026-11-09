"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Lock,
  Mail,
  Shield,
  Users,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { SUPPORT_EMAIL } from "@/lib/company/contact";
import { loginErrorMessage } from "@/lib/security/login-errors";
import { cn } from "@/lib/utils";
import "./portal-auth.css";

const DEFAULT_TRUST = [
  { title: "Secure Access", icon: Shield },
  { title: "Role Based Access", icon: Users },
  { title: "Audit Logging", icon: FileText },
] as const;

/** Left cinematic panel — same forecourt plate + framing as dealer login. */
export function BrandPanel({
  kicker,
  headline,
  highlight,
  lede,
  ariaLabel = "Trinity Retail Intelligence",
}: {
  kicker: string;
  /** First line of the caption (before the highlight line). */
  headline: ReactNode;
  /** Yellow emphasized line (second line). */
  highlight: ReactNode;
  lede: string;
  ariaLabel?: string;
}) {
  return (
    <aside className="dl__brand" aria-label={ariaLabel}>
      <div
        className="dl__brand-bg"
        role="img"
        aria-label="TrinityNRG fuel station at sunset"
      />
      <div className="dl__brand-veil" aria-hidden />
      <div className="dl__brand-inner">
        <div className="dl__brand-top">
          <TrinityLogo variant="dark" height={46} />
          <div className="dl__eyebrow">
            <span className="dl__eyebrow-line" aria-hidden />
            <span className="dl__eyebrow-text">Trinity Retail Intelligence</span>
          </div>
        </div>

        <div className="dl__brand-copy">
          <div className="dl__kicker">
            <span className="dl__eyebrow-line" aria-hidden />
            <span className="dl__eyebrow-text">{kicker}</span>
          </div>
          <h1 className="dl__headline">
            {headline}
            <br />
            <span>{highlight}</span>
          </h1>
          <p className="dl__lede">{lede}</p>
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
  forgotPortal,
  trust = DEFAULT_TRUST,
  brand,
}: {
  portal: "staff" | "dealer" | "depot";
  badge: string;
  badgeTone?: "blue" | "green";
  title: string;
  description: string;
  button: string;
  destination: string;
  support: string;
  /** Query value for forgot-password; defaults to `portal`. */
  forgotPortal?: string;
  trust?: readonly { title: string; icon: React.ComponentType<{ className?: string }> }[];
  brand: ReactNode;
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
    const result = await signIn("credentials", {
      email,
      password,
      portal,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(
        loginErrorMessage(
          result.error,
          "Invalid credentials, or this account is not provisioned for this portal."
        )
      );
      return;
    }
    router.push(destination);
    router.refresh();
  }

  const forgotHref = `/intelligence/forgot-password?portal=${forgotPortal ?? portal}`;

  return (
    <div className="dl">
      {brand}

      <section className="dl__panel">
        <div className="dl__card">
          <div className="dl__card-head">
            <div className="dl__card-logo">
              <TrinityLogo variant="dark" height={48} />
            </div>
            <div className={cn("dl__badge", badgeTone === "green" && "dl__badge--green")}>
              <Lock aria-hidden />
              {badge}
            </div>
            <h2 className="dl__title">{title}</h2>
            <p className="dl__copy">{description}</p>
            <Link href="/access" className="dl__back">
              Back to access options
            </Link>
          </div>

          <form onSubmit={onSubmit} className="dl__form">
            <div className="dl__field">
              <label htmlFor="email">Email Address</label>
              <div className="dl__input-wrap">
                <Mail className="dl__input-icon" aria-hidden />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.co.ke"
                  className="dl__input"
                />
              </div>
            </div>

            <div className="dl__field">
              <label htmlFor="password">Password</label>
              <div className="dl__input-wrap">
                <Lock className="dl__input-icon" aria-hidden />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="dl__input"
                />
                <button
                  type="button"
                  className="dl__input-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="dl__row">
              <button
                type="button"
                className="dl__remember"
                onClick={() => setRemember((v) => !v)}
              >
                <span className={cn("dl__check", remember && "is-on")}>
                  {remember ? "✓" : ""}
                </span>
                Remember me
              </button>
              <Link href={forgotHref} className="dl__forgot">
                Forgot Password?
              </Link>
            </div>

            {error ? (
              <div className="dl__error" role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" className="dl__submit" disabled={loading}>
              <span className="dl__submit-label">
                {loading ? "Signing in..." : button}
              </span>
              <span className="dl__submit-arrow" aria-hidden>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </form>

          <a className="dl__help" href={`mailto:${SUPPORT_EMAIL}`}>
            <span className="dl__help-icon" aria-hidden>
              <Headphones className="h-4 w-4" />
            </span>
            <span className="dl__help-copy">
              <span className="dl__help-title">Need Help?</span>
              <span className="dl__help-text">{support}</span>
            </span>
            <span className="dl__help-go" aria-hidden>
              <ArrowRight className="h-4 w-4" />
            </span>
          </a>

          <div className="dl__trust">
            {trust.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="dl__trust-item">
                  <div className="dl__trust-icon">
                    <Icon aria-hidden />
                  </div>
                  <div className="dl__trust-title">{item.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
