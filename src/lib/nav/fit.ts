/** How many nav tabs fit in `available` px; when some don't, room is kept for the "More" button. */
export function fitCount(widths: number[], available: number, moreWidth: number): number {
  if (widths.reduce((a, b) => a + b, 0) <= available) return widths.length;
  let used = moreWidth;
  let n = 0;
  while (n < widths.length && used + widths[n] <= available) used += widths[n++];
  return n;
}
