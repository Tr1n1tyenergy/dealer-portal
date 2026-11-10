import type { CSSProperties, ReactNode } from "react";
import "./photo-hero.css";

/** The photo header on the three home screens: place in yellow, greeting, one sentence, the buttons. */
export function PhotoHero({
  image = "/assets2/img/brand/station-sunset.jpg",
  place,
  title,
  sentence,
  actions,
}: {
  image?: string;
  place?: string;
  title: string;
  sentence: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="photo-hero" style={{ "--photo-hero-image": `url("${image}")` } as CSSProperties}>
      <div className="photo-hero__text">
        {place ? <span className="photo-hero__place">{place}</span> : null}
        <h1>{title}</h1>
        <p>{sentence}</p>
      </div>
      {actions ? <div className="photo-hero__actions">{actions}</div> : null}
    </section>
  );
}
