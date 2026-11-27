/** Shared DOM helpers for brand loaders — which content is on screen, and when it is ready. */

/** Prefer the portal shell for the current URL so a leftover login/access node is not fingerprinted. */
export function contentRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const path = window.location.pathname;
  if (path.startsWith("/dealer") || path.startsWith("/depot")) {
    return (
      document.querySelector<HTMLElement>(".dp-content") ??
      document.querySelector<HTMLElement>(".dl, .tri-access, main")
    );
  }
  if (path.startsWith("/intelligence")) {
    return (
      document.querySelector<HTMLElement>(".sp-main, .tri-main") ??
      document.querySelector<HTMLElement>(".dl, .tri-access, main")
    );
  }
  if (path.startsWith("/access")) {
    return document.querySelector<HTMLElement>(".tri-access, main");
  }
  return document.querySelector<HTMLElement>(
    ".dp-content, .sp-main, .tri-main, .tri-access, .dl, main"
  );
}

/** "loading" while a route skeleton is up; otherwise a fingerprint of the current view. */
export function contentSignature(root = contentRoot()): string {
  if (!root) return "";
  if (root.querySelector(".bl-page")) return "loading";
  const heading = root.querySelector("h1, h2")?.textContent?.trim() ?? "";
  return `${heading}|${root.childElementCount}|${root.innerText.length}`;
}

/** True when the welcome splash (not the preview) is covering the app. */
export function splashIsCovering(): boolean {
  if (typeof document === "undefined") return false;
  const splash = document.querySelector(".bl-splash");
  return Boolean(splash && !splash.classList.contains("is-leaving"));
}

/** Destination path has left the start URL and is not showing a route skeleton. */
export function destinationContentReady(fromPath: string): boolean {
  if (typeof window === "undefined") return false;
  const here = `${window.location.pathname}${window.location.search}`;
  const fromKey = fromPath.split(/[?#]/)[0]?.replace(/\/$/, "") || "/";
  const hereKey = here.split(/[?#]/)[0]?.replace(/\/$/, "") || "/";
  if (hereKey === fromKey) return false;

  const path = window.location.pathname;
  // Wait for the real portal shell — a leftover login `.dl` must not count as arrived.
  if ((path.startsWith("/dealer") || path.startsWith("/depot")) && !document.querySelector(".dp-content")) {
    return false;
  }
  if (
    path.startsWith("/intelligence") &&
    !path.endsWith("/login") &&
    !document.querySelector(".sp-main, .tri-main")
  ) {
    return false;
  }

  return contentSignature() !== "loading";
}
