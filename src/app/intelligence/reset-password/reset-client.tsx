"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/access/auth-layout";

export default function ResetPasswordPage() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Reset failed");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { loginPath?: unknown };
    router.push(typeof data.loginPath === "string" ? data.loginPath : "/intelligence/login");
  }

  return (
    <AuthLayout headline="Choose a new password." copy="After you save it, every other device signed in to your account is signed out.">
      <h2 className="login-title">Choose a new password</h2>
      <p className="login-copy">Use at least 8 characters.</p>
      <form onSubmit={onSubmit}>
        <div className="login-field">
          <label htmlFor="reset-password">New password</label>
          <input id="reset-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" style={{ paddingLeft: 14 }} autoComplete="new-password" />
        </div>
        <div className="login-field">
          <label htmlFor="reset-confirm">Confirm password</label>
          <input id="reset-confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="login-input" style={{ paddingLeft: 14 }} autoComplete="new-password" />
        </div>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <button type="submit" className="ui-btn ui-btn--primary login-submit" disabled={loading || !token}>
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthLayout>
  );
}
