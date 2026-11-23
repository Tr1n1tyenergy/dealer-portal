import "./trinity-workspace-loader.css";

/** Branded loading scene. The portal header stays above it. */
export function TrinityWorkspaceLoader({
  label = "Preparing your workspace",
}: {
  label?: string;
}) {
  return (
    <div className="twl is-on" role="status" aria-live="polite" aria-busy="true">
      <span className="twl-sr">{label}. Just a moment please.</span>
      <svg className="twl-paths" viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="twl-paths__line" d="M-40 168C180 120 320 210 520 168C760 116 860 78 1100 132C1280 172 1380 150 1500 96" />
        <path className="twl-paths__line twl-paths__line--slow" d="M-20 250C200 300 380 210 620 248C900 292 1020 210 1260 236C1380 248 1460 220 1520 200" />
        <circle className="twl-paths__node" cx="250" cy="154" r="3.2" />
        <circle className="twl-paths__node" cx="980" cy="118" r="2.6" />
        <circle className="twl-paths__node" cx="1180" cy="142" r="3" />
        <circle className="twl-paths__node twl-paths__node--low" cx="430" cy="268" r="2.8" />
        <circle className="twl-paths__node twl-paths__node--low" cx="1120" cy="228" r="2.4" />
      </svg>

      <div className="twl-stage">
        <div className="twl-mark">
          <svg className="twl-ring" viewBox="0 0 260 260" aria-hidden="true">
            <circle className="twl-ring__guide" cx="130" cy="130" r="118" />
            <g className="twl-ring__spin">
              <circle className="twl-ring__arc twl-ring__arc--blue" cx="130" cy="130" r="104" />
              <circle className="twl-ring__arc twl-ring__arc--blend" cx="130" cy="130" r="104" />
              <circle className="twl-ring__arc twl-ring__arc--gold" cx="130" cy="130" r="104" />
            </g>
            <g className="twl-ring__spin twl-ring__spin--soft">
              <circle className="twl-ring__arc twl-ring__arc--soft" cx="130" cy="130" r="113" />
            </g>
          </svg>
          <img src="/assets2/img/trinity-mark.svg" alt="" className="twl-logo" />
        </div>
        <p className="twl-title" aria-hidden="true">Preparing your workspace...</p>
        <p className="twl-sub" aria-hidden="true">Just a moment please.</p>
        <div className="twl-bar" aria-hidden="true">
          <span className="twl-bar__fill" />
        </div>
      </div>
    </div>
  );
}
