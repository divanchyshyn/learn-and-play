import { FLOAT_POINT, ROD_BASE, ROD_TIP } from './sea.js';
import { Anchor, Kelp, ReefArt, Rock, Sand } from './ReefArt.jsx';

// The whole stage: sky and water, the seabed with whatever the child has
// unlocked, the boat with its angler, the rod and the fishing line. All of it is
// decorative (aria-hidden) – the fish, the crates and the cards carry the game.
//
// Positions are percentages of the sea box, and the boat is anchored to the
// waterline (see `--waterline` in style.css), so the whole scene keeps its shape
// from a phone up to a desktop.

function Sky() {
  return <div className="sea-sky" aria-hidden="true">
    <span className="sea-sun" />
    <span className="sea-cloud cloud-a" />
    <span className="sea-cloud cloud-b" />
    <span className="sea-gull gull-a" />
    <span className="sea-gull gull-b" />
  </div>;
}

function Water() {
  return <div className="sea-water" aria-hidden="true">
    <span className="sea-beam beam-a" />
    <span className="sea-beam beam-b" />
    <span className="sea-bubble bubble-a" />
    <span className="sea-bubble bubble-b" />
    <span className="sea-bubble bubble-c" />
    <span className="sea-bubble bubble-d" />
    <span className="lake-kelp kelp-a"><Kelp /></span>
    <span className="lake-kelp kelp-b"><Kelp /></span>
  </div>;
}

function SeaBed({ decorations }) {
  return <>
    <div className="sea-bed" aria-hidden="true">
      <span className="sand-strip"><Sand /></span>
    </div>
    <div className="sea-floor" aria-hidden="true">
      <span className="reef-item reef-rock"><Rock /></span>
      <span className="reef-item reef-anchor"><Anchor /></span>
      {decorations.map((reward, index) => (
        <span
          className={`reef-item reward reward-${reward.id}`}
          key={`${reward.id}-${index}`}
          style={{ left: `${reward.x}%`, top: `${reward.y}%`, width: `${reward.size}px` }}
        >
          <ReefArt id={reward.id} />
        </span>
      ))}
    </div>
  </>;
}

// The boat: hull, cabin, mast with the trip flag, and the angler whose hands
// hold the rod. The rod itself lives in the line layer, exactly where the line
// starts, so the two always meet.
function Boat({ tripNumber }) {
  return <div className="boat" aria-hidden="true">
    <svg className="boat-drawing" viewBox="0 0 220 190" focusable="false">
      <path className="boat-mast" d="M150 18 L150 112" />
      <path className="boat-flag" d="M152 20 L202 33 L152 46 Z" />
      <text className="boat-flag-number" x="166" y="40">{tripNumber}</text>

      <path className="boat-hull" d="M10 118 L210 118 L184 164 Q 110 178 36 164 Z" />
      <path className="boat-deck" d="M10 110 L210 110 L208 122 L12 122 Z" />

      <path className="boat-cabin" d="M108 84 L182 84 L186 112 L104 112 Z" />
      <circle className="boat-window" cx="145" cy="98" r="10" />

      <path className="angler-body" d="M28 112 L28 84 Q 28 76 38 76 L54 76 Q 64 76 64 84 L64 112 Z" />
      <circle className="angler-head" cx="46" cy="62" r="13" />
      <path className="angler-hat" d="M24 58 Q 46 38 68 58 Z" />
      <path className="angler-hat" d="M22 58 L70 58 L70 65 L22 65 Z" />
      <path className="angler-arm" d="M60 88 Q 66 84 70 80" />
      <path className="boat-net" d="M96 108 Q 106 120 116 108 Z" />
    </svg>
  </div>;
}

function LineLayer({ target, onLine, slack }) {
  const midX = (ROD_TIP.x + target.x) / 2 + 1.5;
  // A slack line sags: the less grip the rod has on the fish, the deeper the
  // curve, which is the child's first sign that the fish is about to get away.
  const midY = (ROD_TIP.y + target.y) / 2 + 4.5 * slack;
  return <svg className="line-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <line className="rod-line" x1={ROD_BASE.x} y1={ROD_BASE.y} x2={ROD_TIP.x} y2={ROD_TIP.y} />
    <path
      className={`fishing-line${onLine && slack < 0.5 ? ' taut' : ''}`}
      d={`M ${ROD_TIP.x} ${ROD_TIP.y} Q ${midX} ${midY} ${target.x} ${target.y}`}
    />
  </svg>;
}

export function SeaScene({ decorations, lineTo, tripNumber, onLine, slack = 0, children }) {
  return <>
    <Sky />
    <Water />
    <SeaBed decorations={decorations} />
    <Boat tripNumber={tripNumber} />
    {!onLine && <span className="fishing-float" style={{ left: `${FLOAT_POINT.x}%`, top: `${FLOAT_POINT.y}%` }} aria-hidden="true" />}
    <LineLayer target={lineTo} onLine={onLine} slack={slack} />
    {children}
  </>;
}
