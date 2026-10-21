"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex min-h-screen items-center justify-center bg-trinity-bg px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-8 shadow-[0_24px_60px_rgba(10,35,91,0.12)]"
      >
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Password Recovery
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email and we will send a secure reset link.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              If an account exists, a reset link has been sent.
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
          <div className="text-center text-sm">
            <Link href={loginHref} className="font-semibold text-trinity-blue">
              Back to Login
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
