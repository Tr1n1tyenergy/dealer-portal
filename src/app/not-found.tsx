import Link from "next/link";
import { AuthLayout } from "@/components/access/auth-layout";

export default function NotFound() {
  return (
    <AuthLayout headline="This page isn't on the map." copy="The address may be mistyped, or the page has moved.">
      <h2 className="login-title">Page not found</h2>
      <p className="login-copy">Check the address, or go back to your home page.</p>
      <Link href="/access" className="ui-btn ui-btn--primary login-submit">
        Go to your home page
      </Link>
    </AuthLayout>
  );
}
