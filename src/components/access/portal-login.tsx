"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthLayout } from "@/components/access/auth-layout";
import { loginErrorMessage } from "@/lib/security/login-errors";

const KICKER = { dealer: "Dealer portal", depot: "Depot portal", staff: "Trinity staff" } as const;

/** Sign-in for one portal; the same sign-in call and destination as before, in the shared layout. */
export function PortalLogin({
  portal,
  title,
  description,
  button,
  destination,
  headline,
  copy,
}: {
  portal: "dealer" | "depot" | "staff";
  title: string;
  description: string;
  button: string;
  destination: string;
  headline: string;
  copy: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout kicker={KICKER[portal]} headline={headline} copy={copy}>
      <h2 className="login-title">{title}</h2>
      <p className="login-copy">{description}</p>
      <form onSubmit={onSubmit}>
        <div className="login-field">
          <label htmlFor="email">Email address</label>
          <div className="login-input-wrap">
            <Mail className="login-input-icon" aria-hidden />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.ke" className="login-input" />
          </div>
        </div>
        <div className="login-field">
          <label htmlFor="password">Password</label>
          <div className="login-input-wrap">
            <Lock className="login-input-icon" aria-hidden />
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="login-input" />
            <button type="button" className="login-input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="login-row">
          <Link href={`/intelligence/forgot-password?portal=${portal}`} className="login-forgot">Forgot password?</Link>
        </div>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <button type="submit" className="ui-btn ui-btn--primary login-submit" disabled={loading}>
          {loading ? "Signing in…" : button}
        </button>
      </form>
      <p className="login-foot">
        <Link href="/access" className="login-back">Choose a different portal</Link>
      </p>
    </AuthLayout>
  );
}
