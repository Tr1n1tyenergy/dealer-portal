import "./intelligence-background.css";

/**
 * Premium executive-intelligence page background.
 * Fixed layers: navy gradients, sparse network SVG, particles, TRI watermark.
 */
export function IntelligenceBackground() {
  return (
    <div className="intel-bg" aria-hidden>
      <div className="intel-bg__base" />

      <svg
        className="intel-bg__network"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large sweeping signal curves */}
        <path
          d="M-120 620 Q 280 380, 620 520 T 1180 340 T 1620 480"
          fill="none"
          stroke="rgba(95, 145, 255, 0.10)"
          strokeWidth="1"
        />
        <path
          d="M-80 180 Q 360 420, 720 260 T 1380 120"
          fill="none"
          stroke="rgba(95, 145, 255, 0.08)"
          strokeWidth="1"
        />
        <path
          d="M200 900 Q 520 640, 900 760 T 1500 600"
          fill="none"
          stroke="rgba(245, 180, 0, 0.09)"
          strokeWidth="1"
        />

        {/* Left-edge constellation */}
        <g className="intel-bg__mesh intel-bg__mesh--left">
          <path d="M40 120 L 95 185 L 155 140 L 210 220 L 175 310" fill="none" stroke="rgba(95, 155, 255, 0.12)" strokeWidth="1" />
          <path d="M55 380 L 120 420 L 185 360 L 240 450" fill="none" stroke="rgba(95, 155, 255, 0.10)" strokeWidth="1" />
          <path d="M30 580 L 110 640 L 200 590 L 260 680" fill="none" stroke="rgba(95, 155, 255, 0.08)" strokeWidth="1" />
          <path d="M95 185 L 120 420" fill="none" stroke="rgba(95, 155, 255, 0.08)" strokeWidth="1" />
          <circle cx="40" cy="120" r="2.5" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="95" cy="185" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="155" cy="140" r="3" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="210" cy="220" r="2" fill="rgba(245, 180, 0, 0.60)" />
          <circle cx="175" cy="310" r="2.5" fill="rgba(55, 135, 255, 0.32)" />
          <circle cx="55" cy="380" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="120" cy="420" r="3" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="185" cy="360" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="240" cy="450" r="2.5" fill="rgba(245, 180, 0, 0.55)" />
          <circle cx="30" cy="580" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="110" cy="640" r="3" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="200" cy="590" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="260" cy="680" r="2.5" fill="rgba(55, 135, 255, 0.32)" />
        </g>

        {/* Right-edge constellation */}
        <g className="intel-bg__mesh intel-bg__mesh--right">
          <path d="M1180 90 L 1240 160 L 1310 110 L 1380 200 L 1340 290" fill="none" stroke="rgba(95, 155, 255, 0.12)" strokeWidth="1" />
          <path d="M1200 400 L 1270 460 L 1350 390 L 1410 480" fill="none" stroke="rgba(95, 155, 255, 0.10)" strokeWidth="1" />
          <path d="M1160 620 L 1250 680 L 1330 630 L 1400 720" fill="none" stroke="rgba(95, 155, 255, 0.08)" strokeWidth="1" />
          <path d="M1240 160 L 1270 460" fill="none" stroke="rgba(95, 155, 255, 0.08)" strokeWidth="1" />
          <path d="M1310 110 Q 1280 280, 1350 390" fill="none" stroke="rgba(95, 155, 255, 0.07)" strokeWidth="1" />
          <circle cx="1180" cy="90" r="2.5" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="1240" cy="160" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="1310" cy="110" r="3" fill="rgba(245, 180, 0, 0.65)" />
          <circle cx="1380" cy="200" r="2" fill="rgba(55, 135, 255, 0.32)" />
          <circle cx="1340" cy="290" r="2.5" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="1200" cy="400" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="1270" cy="460" r="3" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="1350" cy="390" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="1410" cy="480" r="2.5" fill="rgba(245, 180, 0, 0.55)" />
          <circle cx="1160" cy="620" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="1250" cy="680" r="3" fill="rgba(55, 135, 255, 0.35)" />
          <circle cx="1330" cy="630" r="2" fill="rgba(55, 135, 255, 0.30)" />
          <circle cx="1400" cy="720" r="2.5" fill="rgba(55, 135, 255, 0.32)" />
        </g>

        {/* Lower-corner accents */}
        <g className="intel-bg__mesh intel-bg__mesh--corners">
          <path d="M60 820 L 140 780 L 220 830" fill="none" stroke="rgba(95, 155, 255, 0.09)" strokeWidth="1" />
          <path d="M1280 800 L 1360 760 L 1420 820" fill="none" stroke="rgba(95, 155, 255, 0.09)" strokeWidth="1" />
          <circle cx="60" cy="820" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="140" cy="780" r="2.5" fill="rgba(245, 180, 0, 0.50)" />
          <circle cx="220" cy="830" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="1280" cy="800" r="2" fill="rgba(55, 135, 255, 0.28)" />
          <circle cx="1360" cy="760" r="2.5" fill="rgba(55, 135, 255, 0.32)" />
          <circle cx="1420" cy="820" r="2" fill="rgba(245, 180, 0, 0.50)" />
        </g>

        {/* Sparse center-passing micro connections */}
        <g className="intel-bg__mesh intel-bg__mesh--center" opacity="0.55">
          <path d="M320 200 Q 520 240, 720 210" fill="none" stroke="rgba(95, 155, 255, 0.06)" strokeWidth="1" />
          <path d="M680 680 Q 860 640, 1040 700" fill="none" stroke="rgba(95, 155, 255, 0.06)" strokeWidth="1" />
          <circle cx="320" cy="200" r="1.5" fill="rgba(160, 205, 255, 0.25)" />
          <circle cx="720" cy="210" r="1.5" fill="rgba(160, 205, 255, 0.22)" />
          <circle cx="680" cy="680" r="1.5" fill="rgba(160, 205, 255, 0.22)" />
          <circle cx="1040" cy="700" r="1.5" fill="rgba(245, 180, 0, 0.35)" />
        </g>
      </svg>

      <div className="intel-bg__particles">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className={`intel-bg__particle ${p.gold ? "is-gold" : ""}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      <div className="intel-bg__watermark">TRI</div>
    </div>
  );
}

const PARTICLES = [
  { id: 1, x: 8, y: 14, opacity: 0.28, delay: 0, gold: false },
  { id: 2, x: 14, y: 42, opacity: 0.22, delay: 2.4, gold: false },
  { id: 3, x: 6, y: 68, opacity: 0.25, delay: 5.1, gold: true },
  { id: 4, x: 22, y: 82, opacity: 0.2, delay: 8.3, gold: false },
  { id: 5, x: 88, y: 18, opacity: 0.26, delay: 1.2, gold: false },
  { id: 6, x: 92, y: 38, opacity: 0.24, delay: 4.6, gold: true },
  { id: 7, x: 86, y: 58, opacity: 0.22, delay: 7.8, gold: false },
  { id: 8, x: 94, y: 76, opacity: 0.28, delay: 11.2, gold: false },
  { id: 9, x: 78, y: 88, opacity: 0.2, delay: 3.5, gold: false },
  { id: 10, x: 12, y: 28, opacity: 0.18, delay: 9.4, gold: false },
  { id: 11, x: 18, y: 55, opacity: 0.24, delay: 6.2, gold: false },
  { id: 12, x: 82, y: 48, opacity: 0.2, delay: 10.1, gold: false },
  { id: 13, x: 4, y: 90, opacity: 0.22, delay: 12.5, gold: false },
  { id: 14, x: 96, y: 8, opacity: 0.26, delay: 0.8, gold: true },
  { id: 15, x: 28, y: 12, opacity: 0.2, delay: 13.8, gold: false },
  { id: 16, x: 72, y: 92, opacity: 0.22, delay: 5.9, gold: false },
  { id: 17, x: 10, y: 48, opacity: 0.18, delay: 14.2, gold: false },
  { id: 18, x: 90, y: 62, opacity: 0.24, delay: 2.9, gold: false },
  { id: 19, x: 32, y: 72, opacity: 0.2, delay: 7.1, gold: true },
  { id: 20, x: 68, y: 22, opacity: 0.22, delay: 11.8, gold: false },
] as const;
