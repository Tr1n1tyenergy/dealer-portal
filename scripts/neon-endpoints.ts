/**
 * Known Neon compute endpoint IDs for Trinity Retail Intelligence.
 * Used to prevent staging ↔ production mix-ups. Never store credentials here.
 */

/** Neon production branch compute (confirmed by operator). */
export const NEON_PRODUCTION_ENDPOINT_ID = "ep-quiet-wildflower-zaag2pmh";

/** Neon staging branch compute — must never be used by production migrate scripts. */
export const NEON_STAGING_ENDPOINT_ID = "ep-old-shape-zacn3ikk";

export function endpointIdFromUrl(url: string): string | null {
  if (/^file:/i.test(url) || /\.db(\?|$)/i.test(url)) return null;
  try {
    const host = new URL(url).hostname;
    return host.match(/^(ep-[a-z0-9-]+?)(?:-pooler)?\./)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isPoolerUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("-pooler");
  } catch {
    return false;
  }
}

export function isSqliteUrl(url: string): boolean {
  return /^file:/i.test(url) || /\.db(\?|$)/i.test(url) || /sqlite/i.test(url);
}
