"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  Mic,
  Presentation,
  Shield,
  Users,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { cn } from "@/lib/utils";
import "./login.css";
import { loginErrorMessage } from "@/lib/security/login-errors";

const features = [
  {
    title: "Retail Interface",
    description: "Operational retail intelligence.",
    icon: BarChart3,
  },
  {
    title: "AI Note Taker",
    description: "Executive meeting capture & summaries.",
    icon: Mic,
  },
  {
    title: "Presentations",
    description: "Board-ready insights & decks.",
    icon: Presentation,
  },
];

const trust = [
  {
    title: "Enterprise Security",
    subtitle: "256-bit encryption",
    icon: Shield,
  },
  {
    title: "Role Based Access",
    subtitle: "Granular permissions",
    icon: Users,
  },
  {
    title: "Audit Logging",
    subtitle: "Activity monitored",
    icon: FileText,
  },
];

export default function LoginPage() {
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
        portal: "staff",
        redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(loginErrorMessage(result.error, "Invalid credentials or inactive account."));
      return;
    }

    router.push("/intelligence/dashboard");
    router.refresh();
  }

  return (
    <div className="login-shell">
      {/* Left brand panel — side-by-side on desktop */}
      <aside className="login-brand" aria-hidden={false}>
        <div
          className="login-brand__bg"
          style={{ backgroundImage: 'url("/assets2/img/hero/storage.jpg")' }}
        />
        <div className="login-brand__veil" />
        <div className="login-brand__grid" />
        <svg className="login-brand__network" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5B800" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#4A90E2" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path
            d="M0 180 C 160 120, 280 240, 420 160 S 700 80, 900 200"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="1.2"
          />
          <path
            d="M40 420 C 200 360, 320 480, 520 400 S 820 300, 1100 420"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="1"
          />
          <circle cx="220" cy="150" r="3" fill="#F5B800" />
          <circle cx="480" cy="190" r="2.5" fill="#7EB6FF" />
          <circle cx="640" cy="360" r="3" fill="#F5B800" />
        </svg>

        <div className="login-brand__content">
          <div>
            <TrinityLogo variant="light" height={48} />
            <div className="login-eyebrow">
              <div className="login-eyebrow__line" />
              <div className="login-eyebrow__text">Trinity Retail Intelligence</div>
            </div>
          </div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="login-headline"
            >
              Executive retail intelligence for <span>Trinity Energy.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="login-subcopy"
            >
              Actionable insights. Smarter decisions. Stronger operations across East Africa.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="login-features"
            >
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
            </motion.div>
          </div>

          <div className="login-status">
            <span className="login-status__dot" />
            <div>
              <div className="login-status__title">System Operational</div>
              <div className="login-status__sub">East Africa Hub</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right login panel */}
      <section className="login-panel">
        <div className="login-panel__glow" />
        <div className="login-panel__dots" />

        <div className="login-card-wrap">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="login-card"
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <TrinityLogo variant="dark" height={48} />
              </div>
              <div className="login-secure">
                <Lock className="h-3.5 w-3.5" />
                Secure Access
              </div>
              <h2 className="login-title">Sign in</h2>
              <p className="login-copy">
                Accounts are provisioned by an Admin only. There is no public registration.
              </p>
              <p className="login-copy">
                <Link href="/access">Back to access options</Link>
              </p>
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: "1.75rem" }}>
              <div className="login-field">
                <label htmlFor="email">Email</label>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@trinityenergyltd.com"
                    className="login-input"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="login-row">
                <button
                  type="button"
                  className="login-remember"
                  onClick={() => setRemember((v) => !v)}
                >
                  <span className={cn("login-check", remember && "is-on")}>
                    {remember ? (
                      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6.5 L4.5 9 L10 3" />
                      </svg>
                    ) : null}
                  </span>
                  Remember me
                </button>
                <Link href="/intelligence/forgot-password" className="login-forgot">
                  Forgot Password?
                </Link>
              </div>

              {error ? <div className="login-error">{error}</div> : null}

              <button type="submit" className="login-submit" disabled={loading}>
                <span className="login-submit__label">
                  {loading ? "Signing in..." : "Login"}
                </span>
                <span className="login-submit__arrow">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </form>

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
          </motion.div>

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
