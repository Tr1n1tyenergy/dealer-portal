"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthLayout } from "@/components/access/auth-layout";

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

  return (
    <AuthLayout
      kicker={portal === "dealer" ? "Dealer portal" : "Trinity staff"}
      headline={portal === "dealer" ? "Welcome to the dealer portal." : "Welcome to Trinity Retail Intelligence."}
      copy="Choose a password to finish setting up your account. Invitation links work for 7 days."
    >
      <h2 className="login-title">{title}</h2>
      <p className="login-copy">{subtitle}</p>
      <form onSubmit={onSubmit}>
        <div className="login-field">
          <label htmlFor="activate-email">Email address</label>
          <div className="login-input-wrap">
            <Mail className="login-input-icon" aria-hidden />
            <input id="activate-email" type="email" readOnly disabled value={lookupDone ? email || "—" : "Loading…"} className="login-input" />
          </div>
        </div>
        <div className="login-field">
          <label htmlFor="activate-password">Password</label>
          <div className="login-input-wrap">
            <Lock className="login-input-icon" aria-hidden />
            <input id="activate-password" type={showPw ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" className="login-input" autoComplete="new-password" />
            <button type="button" className="login-input-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="login-field">
          <label htmlFor="activate-confirm">Confirm password</label>
          <div className="login-input-wrap">
            <Lock className="login-input-icon" aria-hidden />
            <input id="activate-confirm" type={showPw ? "text" : "password"} required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className="login-input" autoComplete="new-password" />
          </div>
        </div>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <button type="submit" className="ui-btn ui-btn--primary login-submit" disabled={loading || !token}>
          {loading ? "Activating…" : "Set password and activate"}
        </button>
      </form>
      <p className="login-foot">
        <Link href={loginHref} className="login-back">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
