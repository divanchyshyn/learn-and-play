import { RIG_DX, RIG_Y } from './rig.js';
import { BoatArt } from './BoatArt.jsx';
import { SeaArtDefs, paint } from './SeaArtDefs.jsx';
import { Anchor, Driftwood, RockCluster, SandFloor, Stones } from './SeaFloor.jsx';
import { SkyLayer } from './SeaSky.jsx';
import { WaterBody, WaveLine } from './SeaWater.jsx';
import { ReefArt } from './ReefRewards.jsx';

// The whole stage: sky and water, the seabed with whatever the child has
// unlocked, the boat with its angler, the rod, the float and the line. All of it
// except the controls is decorative (aria-hidden) – the water surface, the float
// and the crank carry the game.
//
// Positions are percentages of the sea box and everything follows `boat.x`, the
// boat's own left edge, so the whole rig keeps its shape and its place from a
// phone up to a desktop screen (see `RIG_DX` in rig.js).
//
// The art lives in its own modules, each one painted from the shared paints
// (SeaArtDefs) so no gradient is ever defined twice:
//
//   SeaSky      – sun, clouds, gulls and the far shore
//   SeaWater    – the surface line, the light, the drifting snow, the kelp
//   SeaFloor    – sand, rocks, the old anchor, driftwood, stones
//   ReefRewards – the sixteen treasures a finished trip unlocks
//   BoatArt     – the boat, its crew and the gear on deck
//   FishArt     – the six fish species (worn by FishSprite)

// The seabed, with everything the child has found so far. A reward above the sand
// ridge is painted with the far haze (`.is-far`), the newest one pops (`.is-new`),
// and the size is handed over as a custom property so one media query can scale
// the whole collection down on a narrow screen.
function SeaBed({ decorations, newRewardId }) {
  return <>
    <SandFloor />
    <div className="sea-floor" aria-hidden="true">
      <span className="reef-item reef-rock"><RockCluster /></span>
      <span className="reef-item reef-anchor"><Anchor /></span>
      <span className="reef-item reef-driftwood"><Driftwood /></span>
      <span className="reef-item reef-stones"><Stones /></span>
      {decorations.map((reward, index) => (
        <span
          className={[
            'reef-item', 'reward', `reward-${reward.id}`,
            reward.y < 84 ? 'is-far' : 'is-near',
            reward.id === newRewardId ? 'is-new' : '',
          ].filter(Boolean).join(' ')}
          key={`${reward.id}-${index}`}
          style={{ left: `${reward.x}%`, top: `${reward.y}%`, '--reward-size': `${reward.size}px` }}
        >
          <ReefArt id={reward.id} />
        </span>
      ))}
    </div>
  </>;
}

// The boat, plus the wake and the spray it drags along when it is under way. The
// drawing itself is BoatArt; this only decides how it moves.
function Boat({ boat, tripNumber }) {
  const sailing = boat.x !== boat.targetX;
  return <div
    className={`boat${sailing ? ' is-sailing' : ''}`}
    style={{ left: `${boat.x}%`, '--facing': boat.targetX < boat.x ? -1 : 1 }}
    aria-hidden="true"
  >
    {sailing && <>
      <span className="boat-wake" />
      <span className="boat-wake boat-wake-far" />
      <span className="boat-spray" />
    </>}
    <BoatArt tripNumber={tripNumber} />
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
//
// The float itself is a little painted spool with an antenna, a band and a sheen,
// and it drags a ripple ring on the surface while it lies there.
function FloatArt() {
  return <svg className="float-art" viewBox="0 0 26 38" aria-hidden="true" focusable="false">
    <ellipse className="float-ripple" cx="13" cy="34" rx="12" ry="3.4" fill={paint('wake')} />
    <path className="float-antenna" d="M13 4 L13 14" />
    <circle className="float-tip" cx="13" cy="3.4" r="2.6" fill={paint('flag')} />
    <path className="float-body" d="M13 7 C 19 7 22.4 15 22.4 23 C 22.4 30 18.6 34 13 34 C 7.4 34 3.6 30 3.6 23 C 3.6 15 7 7 13 7 Z" fill={paint('flag')} />
    <path className="float-band" d="M4 21 C 8 23 18 23 22 21 L22.2 25 C 18 27 8 27 3.8 25 Z" fill={paint('hull-band')} />
    <path className="float-band-thin" d="M4.6 17 C 8.6 19 17.4 19 21.4 17 L21.5 18.6 C 17.4 20.6 8.6 20.6 4.5 18.6 Z" fill={paint('hull-band')} opacity=".85" />
    <ellipse className="float-sheen" cx="9" cy="14" rx="2.6" ry="4.6" fill="#ffffff" opacity=".45" />
  </svg>;
}

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
      <span className={classes.join(' ')} aria-hidden="true"><FloatArt /></span>
      <span className="strike-call" aria-hidden="true">Napp!</span>
    </button>;
  }
  return <span className={classes.join(' ')} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true">
    <FloatArt />
  </span>;
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
  decorations, newRewardId, boat, bait, baitPoint, lineTo, canStrike, nudge, tripNumber,
  onSail, onStep, onStrike, children,
}) {
  return <>
    <SeaArtDefs />
    <SkyLayer />
    <WaterBody />
    <WaveLine />
    <SeaBed decorations={decorations} newRewardId={newRewardId} />
    <SailMarker boat={boat} nudge={nudge} />
    <Boat boat={boat} tripNumber={tripNumber} />
    <LineLayer boat={boat} target={lineTo} />
    <SailSurface onSail={onSail} onStep={onStep} />
    <Float point={baitPoint} bait={bait} canStrike={canStrike} onStrike={onStrike} />
    {children}
  </>;
}
