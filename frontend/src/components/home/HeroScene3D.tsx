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
              style={{ background: c, transform: `translateZ(${-i * 3}px)` }}
            />
          ))}
          <div className="hero3d-hexface hero3d-medalface" style={{ background: "#3f9d75", transform: "translateZ(3px)" }}>
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

        {/* Three achievement hexes bobbing at different depths */}
        <AchHex className="hero3d-ach hero3d-ach--1" color="#5b8def" depth={70}>
          <Star />
        </AchHex>
        <AchHex className="hero3d-ach hero3d-ach--2" color="#e0a005" depth={-46}>
          <Bolt />
        </AchHex>
        <AchHex className="hero3d-ach hero3d-ach--3" color="#45a37c" depth={24}>
          <Check />
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

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.9 6.1 21l1.1-6.5-4.7-4.6 6.5-.95z" /></svg>
  );
}
function Bolt() {
  return <svg viewBox="0 0 24 24" fill="#fff"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>;
}
function Check() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>;
}
