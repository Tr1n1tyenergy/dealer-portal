import Link from "next/link";

/** Index of local loader previews (outside auth matcher). */
export default function DevLoadersIndexPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        margin: 0,
        padding: "2.5rem clamp(1.25rem, 4vw, 3rem)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        background: "#f7f8fb",
        color: "#0f1d45",
      }}
    >
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Loader previews</h1>
      <p style={{ margin: "0 0 1.75rem", color: "#52617a", maxWidth: "36rem" }}>
        Local-only routes to inspect brand loaders without signing in or navigating between pages.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.75rem", maxWidth: "28rem" }}>
        <li>
          <Link
            href="/dev/portal-loader"
            style={{
              display: "block",
              padding: "0.9rem 1.1rem",
              borderRadius: "0.75rem",
              background: "#fff",
              color: "#3551a5",
              textDecoration: "none",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(20, 36, 77, 0.06)",
            }}
          >
            Portal orbit (T + circling dots)
          </Link>
        </li>
        <li>
          <Link
            href="/dev/welcome-splash"
            style={{
              display: "block",
              padding: "0.9rem 1.1rem",
              borderRadius: "0.75rem",
              background: "#fff",
              color: "#3551a5",
              textDecoration: "none",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(20, 36, 77, 0.06)",
            }}
          >
            Welcome splash (jumping man)
          </Link>
        </li>
        <li>
          <Link
            href="/dev/page-skeleton"
            style={{
              display: "block",
              padding: "0.9rem 1.1rem",
              borderRadius: "0.75rem",
              background: "#fff",
              color: "#3551a5",
              textDecoration: "none",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(20, 36, 77, 0.06)",
            }}
          >
            Page skeleton (containers)
          </Link>
        </li>
      </ul>
    </main>
  );
}
