"use client";

// A live 3D vector scene built from CSS 3D transforms (real depth via preserve-3d)
// and flat-colour SVG — no illustration, no fake UI. A hexagonal graduation
// medallion with stacked faces, a looping CPD progress arc, two orbit rings that
// circle it in 3D, and three achievement hexes bobbing at different depths.
//
// Tweaks are props:
//   animate — turn all motion on/off (also auto-off for prefers-reduced-motion)
//   speed   — motion speed multiplier (1 = default; 2 = twice as fast)
//   tilt    — scene tilt in degrees (rotateX of the whole stage)

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// Extruded medallion side, dark → light front, for genuine stacked depth.
const MEDAL_SHADES = ["#153d2a", "#184630", "#1c5038", "#215c43", "#276b4e", "#2e7d5b", "#379068", "#3f9d75"];

export default function HeroScene3D({
  animate = true,
  speed = 1,
  tilt = 20,
}: {
  animate?: boolean;
  speed?: number;
  tilt?: number;
}) {
  const still = !animate;
  return (
    <div
      className={`hero3d ${still ? "hero3d--still" : ""}`}
      style={{ ["--spd" as string]: String(speed) }}
      aria-hidden
    >
      <div className="hero3d-stage" style={{ transform: `rotateX(${tilt}deg) rotateY(-20deg)` }}>
        {/* Orbit ring A — blue, tilted one way, lime node riding it */}
        <div className="hero3d-orbit hero3d-orbit--a">
          <span className="hero3d-node" style={{ background: "#bef264" }} />
        </div>
        {/* Orbit ring B — teal, tilted the other way, amber node */}
        <div className="hero3d-orbit hero3d-orbit--b">
          <span className="hero3d-node" style={{ background: "#e0a005" }} />
        </div>

        {/* Medallion — stacked hex faces + CPD arc + graduation cap */}
        <div className="hero3d-medallion">
          {MEDAL_SHADES.map((c, i) => (
            <div
              key={i}
              className="hero3d-hexface"
              style={{ background: c, transform: `translateZ(${-i * 4}px)` }}
            />
          ))}
          <div className="hero3d-hexface hero3d-medalface" style={{ background: "#3f9d75", transform: "translateZ(4px)" }}>
            {/* Looping CPD progress arc */}
            <svg viewBox="0 0 100 100" className="hero3d-arc">
              <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="5" />
              <circle
                cx="50" cy="50" r="41" fill="none" stroke="#bef264" strokeWidth="5"
                strokeLinecap="round" strokeDasharray="180 78" className="hero3d-arc-run"
              />
            </svg>
            {/* Graduation cap — flat white vector */}
            <svg viewBox="0 0 64 64" className="hero3d-cap">
              <path d="M32 16 L59 27 L32 38 L5 27 Z" fill="#ffffff" />
              <path d="M16 33 L16 44 C16 51 48 51 48 44 L48 33" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M59 27 L59 43" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
              <circle cx="59" cy="45" r="3.4" fill="#bef264" />
            </svg>
          </div>
        </div>

        {/* Three achievement hexes — badge, certificate, trophy — bobbing at
            different depths */}
        <AchHex className="hero3d-ach hero3d-ach--1" color="#5b8def" depth={70}>
          <Medal />
        </AchHex>
        <AchHex className="hero3d-ach hero3d-ach--2" color="#e0a005" depth={-46}>
          <Certificate />
        </AchHex>
        <AchHex className="hero3d-ach hero3d-ach--3" color="#45a37c" depth={24}>
          <Trophy />
        </AchHex>
      </div>
    </div>
  );
}

function AchHex({ className, color, depth, children }: { className: string; color: string; depth: number; children: React.ReactNode }) {
  return (
    <div className={className} style={{ ["--depth" as string]: `${depth}px` }}>
      <div className="hero3d-hexface" style={{ background: color, clipPath: HEX }} />
      <div className="hero3d-ach-icon">{children}</div>
    </div>
  );
}

// Flat white vector achievement marks — a medal badge, a certificate, a trophy.
function Medal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.21 13.89 7 22l5-3 5 3-1.21-8.11" />
      <circle cx="12" cy="8" r="6" />
    </svg>
  );
}
function Certificate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12h-5" />
      <path d="M15 8h-5" />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
    </svg>
  );
}
function Trophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
