import { RIG_DX, RIG_Y } from './rig.js';
import { Anchor, Kelp, ReefArt, Rock, Sand } from './ReefArt.jsx';

// The whole stage: sky and water, the seabed with whatever the child has
// unlocked, the boat with its angler, the rod, the float and the line. All of it
// except the controls is decorative (aria-hidden) – the water surface, the float
// and the crank carry the game.
//
// Positions are percentages of the sea box and everything follows `boat.x`, the
// boat's own left edge, so the whole rig keeps its shape and its place from a
// phone up to a desktop screen (see `RIG_DX` in sea.js).

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
// hold the rod. It sails by its own `left`, so its wake and its heading follow
// it, and the rod (drawn in the line layer off the same anchor) always meets the
// angler's hands.
function Boat({ boat, tripNumber }) {
  const sailing = boat.x !== boat.targetX;
  return <div
    className={`boat${sailing ? ' is-sailing' : ''}`}
    style={{ left: `${boat.x}%`, '--facing': boat.targetX < boat.x ? -1 : 1 }}
    aria-hidden="true"
  >
    {sailing && <span className="boat-wake" />}
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

// Where the boat is headed: a dashed ring on the surface at the tapped spot, so
// a tap is visibly an instruction the child can change their mind about. When a
// tap cannot sail – the line is out, say – a small nudge says why instead of
// leaving the child with a tap that did nothing.
function SailMarker({ boat, nudge }) {
  const sailing = boat.x !== boat.targetX;
  return <>
    {sailing && <span className="sail-marker" style={{ left: `${boat.targetX}%` }} aria-hidden="true" />}
    {nudge && <span className="sea-nudge" key={nudge.key}>{nudge.text}</span>}
  </>;
}

// The rod and the line, in a layer that sails with the boat: its own `left` is
// the boat's, so the rod stays glued to the angler's hands and glides along with
// them, while the line's far end reaches the float below it or the fish that is
// being fought. Its coordinates are the sea box's, measured from the boat's left
// edge, which is exactly what the rig anchors are (see RIG_DX in rig.js).
function LineLayer({ boat, target }) {
  const tip = { x: RIG_DX.rodTip, y: RIG_Y.rodTip };
  const end = target ? { x: target.x - boat.x, y: target.y } : null;
  const midX = end ? (tip.x + end.x) / 2 + 1.5 : tip.x;
  const midY = end ? (tip.y + end.y) / 2 + 2.5 : tip.y + 6;
  return <div className="line-layer" style={{ left: `${boat.x}%` }}>
    <svg className="line-drawing" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line className="rod-line" x1={RIG_DX.rodBase} y1={RIG_Y.rodBase} x2={tip.x} y2={tip.y} />
      {end && <path className="fishing-line" d={`M ${tip.x} ${tip.y} Q ${midX} ${midY} ${end.x} ${end.y}`} />}
    </svg>
  </div>;
}

// The float: a cast in flight, a float bobbing in the water, one being knocked
// about – and, in the one moment it matters, a big tap ring around it, so a
// child's finger cannot miss the fish that has taken the bait.
function Float({ point, bait, canStrike, onStrike }) {
  if (!point) return null;
  const classes = ['fishing-float', `float-${bait.phase}`];
  if (canStrike) {
    return <button
      type="button"
      className="strike-ring"
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      onClick={onStrike}
      aria-label="Napp! Trykk for å feste kroken"
    >
      <span className={classes.join(' ')} aria-hidden="true" />
      <span className="strike-call" aria-hidden="true">Napp!</span>
    </button>;
  }
  return <span className={classes.join(' ')} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true" />;
}

// The water itself is the sailing control: tap the spot the boat should sail to.
// It is a real button, so a keyboard or switch user can sail too – the arrow
// keys move the boat's target one hop at a time. What a tap means is the game's
// decision, not the surface's: the parent nudges when the line is out.
function SailSurface({ onSail, onStep }) {
  function handleClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || 1;
    onSail(((event.clientX - rect.left) / width) * 100);
  }

  function handleKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onStep(event.key === 'ArrowLeft' ? -1 : 1);
  }

  return <button
    type="button"
    className="sea-surface"
    aria-label="Vannet – trykk der båten skal seile"
    aria-describedby="sea-hint"
    onClick={handleClick}
    onKeyDown={handleKeyDown}
  />;
}

export function SeaScene({
  decorations, boat, bait, baitPoint, lineTo, canStrike, nudge, tripNumber,
  onSail, onStep, onStrike, children,
}) {
  return <>
    <Sky />
    <Water />
    <SeaBed decorations={decorations} />
    <SailMarker boat={boat} nudge={nudge} />
    <Boat boat={boat} tripNumber={tripNumber} />
    <LineLayer boat={boat} target={lineTo} />
    <SailSurface onSail={onSail} onStep={onStep} />
    <Float point={baitPoint} bait={bait} canStrike={canStrike} onStrike={onStrike} />
    {children}
  </>;
}
