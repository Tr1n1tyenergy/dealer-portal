"use client";

import { useState } from "react";
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
import "@/components/access/portal-auth.css";

const trust = [
  { title: "Secure access", icon: Shield },
  { title: "Role-based access", icon: Users },
  { title: "Audit logging", icon: FileText },
] as const;

export default function DealerLoginPage() {
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
      portal: "dealer",
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
    router.push("/dealer/dashboard");
    router.refresh();
  }

  return (
    <div className="dl">
      <aside className="dl__brand" aria-label="Dealer Portal">
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
              <span className="dl__eyebrow-text">Dealer Portal</span>
            </div>
            <h1 className="dl__headline">
              Order fuel for your station, <span>seamlessly.</span>
            </h1>
            <p className="dl__lede">
              Place fuel orders, open PFIs, make payments and track deliveries — all in one
              secure dealer portal.
            </p>
          </div>
        </div>
      </aside>

      <section className="dl__panel">
        <div className="dl__card">
          <div className="dl__card-head">
            <div className="dl__card-logo">
              <TrinityLogo variant="dark" height={48} />
            </div>
            <div className="dl__badge">
              <Lock aria-hidden />
              Dealer Portal
            </div>
            <h2 className="dl__title">Sign in to the Dealer Portal</h2>
            <p className="dl__copy">
              Access your dealer account to place fuel orders, view PFIs, manage payments and
              track deliveries.
            </p>
            <Link href="/access" className="dl__back">
              Back to access options
            </Link>
          </div>

          <form onSubmit={onSubmit} className="dl__form">
            <div className="dl__field">
              <label htmlFor="email">Email address</label>
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
              <Link
                href="/intelligence/forgot-password?portal=dealer"
                className="dl__forgot"
              >
                Forgot password?
              </Link>
            </div>

            {error ? (
              <div className="dl__error" role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" className="dl__submit" disabled={loading}>
              <span className="dl__submit-label">
                {loading ? "Signing in..." : "Sign In to Dealer Portal"}
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
              <span className="dl__help-title">Need help?</span>
              <span className="dl__help-text">
                Contact Trinity Support for account setup or any dealer portal assistance.
              </span>
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
