"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex min-h-screen items-center justify-center bg-trinity-bg px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-8 shadow-[0_24px_60px_rgba(10,35,91,0.12)]"
      >
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
          Password Reset
        </div>
        <h1 className="mt-2 text-3xl font-black text-trinity-navy">Choose a new password</h1>

        <div className="mt-6 space-y-4">
          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Saving..." : "Reset Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
