import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security/security-headers";

/** TRI-only app — root `/` is handled by `src/app/page.tsx` → Access Gateway. */
const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from disk, so it must not be bundled; the PFI route also reads assets/pfi (fonts, logo).
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/orders/[id]/pfi": ["./assets/pfi/**", "./node_modules/pdfkit/js/data/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
