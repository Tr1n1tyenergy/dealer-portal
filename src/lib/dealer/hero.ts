/**
 * Shared forecourt hero banner (Dealer Portal pages — not access/login/forgot-password).
 *
 * Matches internal staff Home / Stock Sale heroes exactly:
 *   asset: trinitynrg-forecourt-at-sunset.png?v=6
 *   media: absolute <img> 128% wide, height 100%, object-fit cover, object-position 18% 30%
 *
 * Use <DealerHeroMedia /> inside each portal hero (see dealer-hero-media.tsx).
 * Do not paint the plate via background-image — that cannot match the staff crop.
 *
 * Access / dealer login left panels keep their own framing in portal-auth.css.
 */
export const DEALER_FORECOURT_SRC =
  "/assets2/img/access/trinitynrg-forecourt-at-sunset.png?v=7";

/** @deprecated Prefer <DealerHeroMedia />; kept for non-hero thumbnails only. */
export const dealerHeroPhotoStyle = {
  backgroundImage: "none",
  backgroundColor: "#071833",
} as const;
