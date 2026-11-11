"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  Mail,
  Send,
  UserRound,
} from "lucide-react";
import { TrinityLogo } from "@/components/brand/trinity-logo";
import { SUPPORT_EMAIL } from "@/lib/company/contact";
import { loginPathFor } from "@/lib/security/login-path";
import "@/components/access/portal-auth.css";

type PortalKind = "staff" | "dealer" | "depot";

function portalKindFromQuery(raw: string | null): PortalKind {
  const value = (raw ?? "").toLowerCase();
  if (value === "dealer") return "dealer";
  if (value === "depot") return "depot";
  return "staff";
}

const PORTAL_COPY: Record<
  PortalKind,
  {
    kicker: string;
    badge: string;
    lede: string;
    support: string;
  }
> = {
  staff: {
    kicker: "Staff Portal",
    badge: "Staff Portal",
    lede: "Recover access to the Trinity Retail Intelligence staff portal.",
    support: "Contact Trinity Support for any staff portal assistance.",
  },
  dealer: {
    kicker: "Dealer Portal",
    badge: "Dealer Portal",
    lede: "Recover access to the Trinity Retail Intelligence dealer portal.",
    support: "Contact Trinity Support for any dealer portal assistance.",
  },
  depot: {
    kicker: "Depot Portal",
    badge: "Depot Portal",
    lede: "Recover access to the Trinity Retail Intelligence depot portal.",
    support: "Contact Trinity Support for any depot portal assistance.",
  },
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Dealers and depots arrive with ?portal=…; "Back to Sign In" returns them to their own portal.
  const [portal, setPortal] = useState<PortalKind>("staff");
  const [loginHref, setLoginHref] = useState("/intelligence/login");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("portal");
    setPortal(portalKindFromQuery(raw));
    setLoginHref(loginPathFor(raw));
  }, []);

  const copy = useMemo(() => PORTAL_COPY[portal], [portal]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <div className="dl dl--reset">
      <aside className="dl__brand" aria-label={copy.kicker}>
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
              <span className="dl__eyebrow-text">{copy.kicker}</span>
            </div>
            <h1 className="dl__headline dl__headline--inline">
              Reset your <span>password</span>
            </h1>
            <p className="dl__lede">{copy.lede}</p>
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
              <UserRound aria-hidden />
              {copy.badge}
            </div>
            <h2 className="dl__title">Forgot Your Password?</h2>
            <p className="dl__copy">
              Enter your email address and we&apos;ll send you a secure link to create a new
              password.
            </p>
          </div>

          <form onSubmit={onSubmit} className="dl__form" noValidate={false}>
            <div className="dl__field">
              <label htmlFor="reset-email">Email Address</label>
              <div className="dl__input-wrap">
                <Mail className="dl__input-icon" aria-hidden />
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email address"
                  className="dl__input dl__input--single"
                />
              </div>
            </div>

            {done ? (
              <div className="dl__success" role="status">
                If an account exists, a reset link has been sent.
              </div>
            ) : null}

            <button type="submit" className="dl__submit dl__submit--send" disabled={loading}>
              <Send className="dl__submit-send-ico" aria-hidden />
              <span className="dl__submit-label">
                {loading ? "Sending..." : "Send Reset Link"}
              </span>
            </button>
          </form>

          <div className="dl__nav-back">
            <Link href={loginHref} className="dl__nav-back-link">
              <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
              Back to Sign In
            </Link>
          </div>

          <a className="dl__help" href={`mailto:${SUPPORT_EMAIL}`}>
            <span className="dl__help-icon" aria-hidden>
              <Headphones className="h-4 w-4" />
            </span>
            <span className="dl__help-copy">
              <span className="dl__help-title">Need Help?</span>
              <span className="dl__help-text">{copy.support}</span>
            </span>
            <span className="dl__help-go" aria-hidden>
              <ArrowRight className="h-4 w-4" />
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
