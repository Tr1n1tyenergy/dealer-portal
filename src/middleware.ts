import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { homeForAccount, isPublicPath, loginPathFor } from "@/lib/access";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    if (isPublicPath(path)) return NextResponse.next();

    // withAuth would send logged-out visitors to NextAuth's built-in sign-in page;
    // send them to the login page of the portal they were trying to reach instead.
    if (!token || token.error === "SessionRevoked") {
      return NextResponse.redirect(new URL(loginPathFor(path), req.url));
    }

    const role = token.role;
    const accountType = (token.accountType as string) || "INTERNAL";
    const home = homeForAccount(accountType);

    if (path.startsWith("/intelligence")) {
      if (accountType !== "INTERNAL") {
        return NextResponse.redirect(new URL(home, req.url));
      }
      if (path.startsWith("/intelligence/admin") && role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/intelligence/dashboard", req.url));
      }
    }

    if (path.startsWith("/dealer")) {
      if (accountType !== "DEALER") {
        return NextResponse.redirect(new URL(accountType === "INTERNAL" ? "/intelligence/dashboard" : home, req.url));
      }
    }

    if (path.startsWith("/depot")) {
      if (accountType !== "DEPOT" && role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL(home, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    // Every request reaches the function above, which decides where logged-out visitors go.
    callbacks: { authorized: () => true },
  }
);

export const config = {
  matcher: ["/", "/access", "/intelligence/:path*", "/dealer/:path*", "/depot/:path*"],
};
