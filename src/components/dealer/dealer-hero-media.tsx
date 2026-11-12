import { DEALER_FORECOURT_SRC } from "@/lib/dealer/hero";

/**
 * Staff-identical hero plate for dealer portal pages.
 * Same asset + same geometry as `.sh-hero__img` / `.ssr-hero__img`.
 */
export function DealerHeroMedia() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="dp-hero-media"
          src={DEALER_FORECOURT_SRC}
      alt=""
      aria-hidden
    />
  );
}
