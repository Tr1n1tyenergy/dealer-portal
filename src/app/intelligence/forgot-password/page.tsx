"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/access/auth-layout";
import { loginPathFor } from "@/lib/security/login-path";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Dealers and depots arrive with ?portal=…; "Back to Login" returns them to their own portal.
  const [loginHref, setLoginHref] = useState("/intelligence/login");
  useEffect(() => {
    setLoginHref(loginPathFor(new URLSearchParams(window.location.search).get("portal")));
  }, []);

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
    <AuthLayout headline="Forgotten your password?" copy="We'll email you a link to choose a new one. The link works for one hour.">
      <h2 className="login-title">Reset your password</h2>
      <p className="login-copy">Enter your email and we&apos;ll send you a secure reset link.</p>
      <form onSubmit={onSubmit}>
        <div className="login-field">
          <label htmlFor="forgot-email">Email address</label>
          <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="login-input" style={{ paddingLeft: 14 }} />
        </div>
        {done ? <div className="login-ok" role="status">If an account exists for that email, a reset link is on its way.</div> : null}
        <button type="submit" className="ui-btn ui-btn--primary login-submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="login-foot">
        <Link href={loginHref} className="login-back">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
