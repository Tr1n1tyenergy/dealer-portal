import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security/security-headers";

/** TRI-only app — root `/` is handled by `src/app/page.tsx` → Access Gateway. */
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
