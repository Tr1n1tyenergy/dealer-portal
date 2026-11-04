/** Runs `fn` at most once per `ms`; calls inside the window are dropped. `now` is injectable for tests. */
export function throttle(fn: () => void, ms: number, now: () => number = Date.now) {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < ms) return;
    last = t;
    fn();
  };
}
