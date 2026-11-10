/**
 * Shared forecourt hero banner (Dealer Portal pages).
 * Ultrawide panoramic plate: open sunset sky / water left, canopy right.
 * Size/position via CSS vars so page CSS !important rules still pick them up.
 *
 * Access / dealer login left panels use a separate asset
 * (`trinitynrg-forecourt-at-sunset.png`) — do not reuse this hero plate there.
 *
 * Source: v5 = the v4 plate rebuilt at 3072 × 633 (3×) with the scene taken from the sharp
 * station photo (brand/station-sunset.jpg); v4 was 1024 × 211 and blurred when stretched.
 * Display: cover, anchored right, so the canopy stays in view and the picture is never squashed.
 */
export const DEALER_FORECOURT_SRC = "/assets2/img/access/forecourt-hero-banner-v5.jpg";

/** Cover: the sky on the left is what gets trimmed on narrow or short heroes. The crop position
 * lives in dealer-portal.css (--dp-hero-photo-position) so phones can centre on the forecourt. */
export const DEALER_FORECOURT_SIZE = "cover";
export const DEALER_FORECOURT_ASPECT = "1024 / 211";

export const dealerHeroPhotoStyle = {
  // Shade behind the text (left and top) so the yellow eyebrow and white title read on the photo.
  backgroundImage: [
    "linear-gradient(90deg, rgba(8, 20, 46, 0.62) 0%, rgba(8, 20, 46, 0.3) 45%, rgba(8, 20, 46, 0) 72%)",
    "linear-gradient(180deg, rgba(8, 20, 46, 0.28) 0%, rgba(8, 20, 46, 0) 60%)",
    `url("${DEALER_FORECOURT_SRC}")`,
  ].join(", "),
  backgroundRepeat: "no-repeat",
  ["--dp-hero-photo-size" as string]: DEALER_FORECOURT_SIZE,
  ["--dp-hero-aspect" as string]: DEALER_FORECOURT_ASPECT,
} as const;
