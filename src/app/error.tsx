"use client";

import Link from "next/link";
import { AuthLayout } from "@/components/access/auth-layout";

/** Shown when a page fails unexpectedly; the details stay in the server log. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AuthLayout headline="Something went wrong." copy="Nothing you entered has been lost. Try again, or go back to your home page.">
      <h2 className="login-title">This page couldn&apos;t load</h2>
      <p className="login-copy">Please try again. If it keeps happening, contact Trinity support.</p>
      <button type="button" className="ui-btn ui-btn--primary login-submit" onClick={reset}>
        Try again
      </button>
      <p className="login-foot">
        <Link href="/access" className="login-back">Go to your home page</Link>
      </p>
    </AuthLayout>
  );
}
