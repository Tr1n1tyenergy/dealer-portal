import type { PresentationSlide } from "@/lib/notes";
import type { DeckTheme } from "@/lib/presentations";

/** One slide, scaled by its own width (container query units), in one of the four deck looks. */
export function DeckSlide({
  slide,
  theme = "light",
  n,
  total,
}: {
  slide: PresentationSlide;
  theme?: DeckTheme | string;
  n?: number;
  total?: number;
}) {
  return (
    <div className={`sl sl-${theme}`}>
      <div className="sl-in">
        <img src="/assets2/img/trinity-mark.svg" alt="" className="sl-mark" />
        {slide.id === "title" ? (
          <div className="sl-title">
            <small>Trinity Energy · Retail</small>
            <h2>{slide.title}</h2>
            {slide.subtitle ? <p>{slide.subtitle}</p> : null}
          </div>
        ) : (
          <div className="sl-body">
            <h3>{slide.title}</h3>
            <ul>
              {(slide.bullets ?? []).filter(Boolean).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {n ? <span className="sl-n">{`${n} / ${total}`}</span> : null}
      </div>
    </div>
  );
}
