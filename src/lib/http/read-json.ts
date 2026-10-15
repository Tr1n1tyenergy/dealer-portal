export const INVALID_JSON = "Request body must be valid JSON.";

/** The request's JSON body, or undefined when it is empty or not valid JSON (callers answer 400). */
export async function readJson(req: Request): Promise<unknown | undefined> {
  const text = await req.text().catch(() => "");
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
