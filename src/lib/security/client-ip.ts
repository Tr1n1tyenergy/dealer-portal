type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

function header(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Caller's IP as set by the hosting proxy (Vercel sets x-forwarded-for). */
export function clientIp(headers: HeaderSource): string {
  const forwarded = header(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || header(headers, "x-real-ip")?.trim() || "unknown";
}
