import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { homeForAccount } from "@/lib/access";

const staffPublic = [
  "/intelligence/login",
  "/intelligence/forgot-password",
  "/intelligence/reset-password",
  "/intelligence/activate",
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role;
    const accountType = (token?.accountType as string) || "INTERNAL";
    const path = req.nextUrl.pathname;
    const home = homeForAccount(accountType);

    if (path.startsWith("/intelligence") && !staffPublic.some((p) => path.startsWith(p))) {
      if (accountType !== "INTERNAL") {
        return NextResponse.redirect(new URL(home, req.url));
      }
      if (path.startsWith("/intelligence/admin") && role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/intelligence/dashboard", req.url));
      }
    }

    if (
      path.startsWith("/dealer") &&
      !path.startsWith("/dealer/login") &&
      !path.startsWith("/dealer/activate")
    ) {
      if (accountType !== "DEALER") {
        return NextResponse.redirect(new URL(accountType === "INTERNAL" ? "/intelligence/dashboard" : home, req.url));
      }
    }

    if (path.startsWith("/depot") && !path.startsWith("/depot/login")) {
      if (accountType !== "DEPOT" && role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL(home, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (
          path.startsWith("/access") ||
          path === "/" ||
          staffPublic.some((p) => path.startsWith(p)) ||
          path.startsWith("/dealer/login") ||
          path.startsWith("/dealer/activate") ||
          path.startsWith("/depot/login")
        ) {
          return true;
        }
        if (path.startsWith("/intelligence") || path.startsWith("/dealer") || path.startsWith("/depot")) {
          if (!token || token.error === "SessionRevoked") return false;
          return true;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/", "/access", "/intelligence/:path*", "/dealer/:path*", "/depot/:path*"],
};
