"use client";

import { PortalLoader } from "@/components/ui/brand-loaders";

/** Local preview of the orbit loader — open /dev/portal-loader (not behind auth). */
export default function PortalLoaderPreviewPage() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        margin: 0,
        background: "#ffffff",
      }}
    >
      <PortalLoader label="your workspace" />
    </main>
  );
}
