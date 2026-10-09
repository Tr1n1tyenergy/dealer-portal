"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { BrandPanel } from "@/components/access/portal-login";
import { cn } from "@/lib/utils";
import "@/app/intelligence/login/login.css";

type ActivatePasswordFormProps = {
  portal: "staff" | "dealer";
  loginHref: string;
  title: string;
  subtitle: string;
};

export function ActivatePasswordForm({
  portal,
  loginHref,
  title,
  subtitle,
}: ActivatePasswordFormProps) {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLookupDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.email) setEmail(data.email);
        }
      } finally {
        if (!cancelled) setLookupDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Activation failed");
      return;
    }
    router.push(loginHref);
  }

  const badge = portal === "dealer" ? "Dealer Activation" : "Staff Activation";

  return (
    <div className="login-shell">
      <BrandPanel
        image={
          portal === "dealer"
            ? "/assets2/img/dealer/login-hero.jpg"
            : "/assets2/img/login-hero.jpg"
        }
        headline={portal === "dealer" ? "Welcome," : "Secure access to"}
        highlight={portal === "dealer" ? "partner." : "TRI."}
        copy={
          portal === "dealer"
            ? "Activate your dealer portal account with a strong password."
            : "Activate your staff account to use Trinity Retail Intelligence."
        }
        features={[
          {
            title: "Password first",
            description: "Set credentials before first login.",
            icon: Lock,
          },
          {
            title: "Portal secure",
            description: "Invite tokens expire after 7 days.",
            icon: Shield,
          },
        ]}
        statusTitle="Invitation ready"
        statusSub="Complete activation to sign in"
      />
      <section className="login-panel">
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
              <div className={cn("login-badge", portal === "dealer" && "login-badge--green")}>
                {badge}
              </div>
              <h2 className="login-title">{title}</h2>
              <p className="login-copy">{subtitle}</p>
              <Link href={loginHref} className="login-back">
                Back to login
              </Link>
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: "1.4rem" }}>
              <div className="login-field">
                <label htmlFor="activate-email">Email Address</label>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" />
                  <input
                    id="activate-email"
                    type="email"
                    readOnly
                    disabled
                    value={lookupDone ? email || "—" : "Loading…"}
                    className="login-input"
                  />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="activate-password">Password</label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" />
                  <input
                    id="activate-password"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="login-input"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label="Toggle password"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="activate-confirm">Confirm Password</label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" />
                  <input
                    id="activate-confirm"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="login-input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {error ? <div className="login-error">{error}</div> : null}
              <button type="submit" className="login-submit" disabled={loading || !token}>
                <span className="login-submit__label">
                  {loading ? "Activating…" : "Set password & activate"}
                </span>
                <span className="login-submit__arrow">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </form>
          </motion.div>
          <div className="login-footer">
            <div>© {new Date().getFullYear()} Trinity Energy Limited</div>
          </div>
        </div>
      </section>
    </div>
  );
}
