"use client";

import { PageLoader } from "@/components/ui/brand-loaders";

/** Local preview of the under-header page skeleton — open /dev/page-skeleton (not behind auth). */
export default function PageSkeletonPreviewPage() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f7f8fb",
      }}
    >
      <header
        aria-hidden="true"
        style={{
          flex: "none",
          height: "4.25rem",
          borderBottom: "1px solid rgba(20, 36, 77, 0.08)",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          padding: "0 var(--tri-page-gutter, 1.5rem)",
          color: "#14244d",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          fontSize: "0.85rem",
          fontWeight: 650,
          letterSpacing: "0.04em",
        }}
      >
        Preview header · page skeleton
      </header>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <PageLoader label="Home" />
      </div>
    </main>
  );
}
