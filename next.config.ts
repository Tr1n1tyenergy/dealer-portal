import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security/security-headers";

/** TRI-only app — root `/` is handled by `src/app/page.tsx` → Access Gateway. */
const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from disk, so it must not be bundled; the PFI route also reads the logo.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/orders/[id]/pfi": ["./public/assets2/img/logo.png", "./node_modules/pdfkit/js/data/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
