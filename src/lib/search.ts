/**
 * Prisma passes `contains` text into a SQL LIKE pattern without escaping, so "%" or "_" typed
 * in a search box would act as wildcards. Escape them (and the escape character) to match literally.
 */
export function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
