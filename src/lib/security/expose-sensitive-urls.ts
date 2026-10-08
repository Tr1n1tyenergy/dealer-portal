/**
 * Whether APIs may return activation/reset links to the browser.
 * Never allowed in production. Local/staging only with explicit opt-in.
 */
export function mayExposeSensitiveAuthUrls(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.TRI_EXPOSE_DEV_AUTH_URLS === "1";
}
