/**
 * Shared forecourt hero banner (Dealer Portal pages — not access/login/forgot-password).
 *
 * Pin-point match of Staff Portal hero (`staff-portal-hero.css`):
 *   asset: trinitynrg-forecourt-at-sunset.png?v=5
 *   plate: CSS background cover @ 42% 30%
 *   haze: linear-gradient(90deg, rgba(7,24,51,0.72) → 0.35 → 0.05)
 *   height: --tri-hero-height-capped
 *
 * Painted by `dealer-portal-hero.css`. `<DealerHeroMedia />` is legacy and hidden.
 * Access / dealer login left panels keep their own framing in portal-auth.css.
 */
export const DEALER_FORECOURT_SRC =
  "/assets2/img/access/trinitynrg-forecourt-at-sunset.png?v=5";

/** @deprecated Prefer the CSS plate in dealer-portal-hero.css. */
export const dealerHeroPhotoStyle = {
  backgroundImage: "none",
  backgroundColor: "#071833",
} as const;
