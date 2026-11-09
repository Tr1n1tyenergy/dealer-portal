/**
 * Shared forecourt hero banner (Dealer Portal pages).
 * Ultrawide panoramic plate: open sunset sky / water left, canopy right.
 * Size/position via CSS vars so page CSS !important rules still pick them up.
 *
 * Access / dealer login left panels use a separate asset
 * (`trinitynrg-forecourt-at-sunset.png`) — do not reuse this hero plate there.
 *
 * Display: full plate at native aspect (no cover zoom/crop).
 * Source pixels: 1024 × 211 (as provided — used exactly as-is).
 */
export const DEALER_FORECOURT_SRC = "/assets2/img/access/forecourt-hero-banner-v4.jpg?v=65";

/** Exact plate fit — width 100%, height matches aspect; no cover/contain zoom. */
export const DEALER_FORECOURT_SIZE = "100% 100%";
export const DEALER_FORECOURT_POSITION = "center center";
export const DEALER_FORECOURT_ASPECT = "1024 / 211";

export const dealerHeroPhotoStyle = {
  backgroundImage: `url("${DEALER_FORECOURT_SRC}")`,
  backgroundRepeat: "no-repeat",
  ["--dp-hero-photo-size" as string]: DEALER_FORECOURT_SIZE,
  ["--dp-hero-photo-position" as string]: DEALER_FORECOURT_POSITION,
  ["--dp-hero-aspect" as string]: DEALER_FORECOURT_ASPECT,
} as const;
