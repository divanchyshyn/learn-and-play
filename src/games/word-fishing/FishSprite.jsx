import { REEL_STEPS, fishPosition, fishWord } from './sea.js';

// One fish, drawn as SVG so it actually looks like a fish: forked tail, dorsal
// and pectoral fins, a gill line and a proper eye. The colours come from the
// `fish-<colour>` class in style.css, so a new colour is one CSS line and
// nothing binary ever ships with the game.
//
// A swimming fish is a button (tap it to put it on the line); a fish on the line
// is a button too (tap it to wind the reel). A fish that has been delivered is
// purely decorative – it is busy sinking into its crate.
function FishArt() {
  return <svg className="fish-drawing" viewBox="0 0 120 72" aria-hidden="true" focusable="false">
    <path className="fish-tail" d="M34 36 L4 8 L14 36 L4 64 Z" />
    <path className="fish-dorsal" d="M46 16 Q 60 0 78 14 Z" />
    <ellipse className="fish-body" cx="68" cy="36" rx="38" ry="24" />
    <path className="fish-pectoral" d="M62 52 Q 74 66 88 54 Z" />
    <path className="fish-gill" d="M56 20 Q 50 36 56 52" />
    <circle className="fish-spot" cx="70" cy="29" r="4" />
    <circle className="fish-spot" cx="80" cy="45" r="2.8" />
    <circle className="fish-eye" cx="92" cy="28" r="8" />
    <circle className="fish-pupil" cx="95" cy="28" r="3.6" />
    <path className="fish-mouth" d="M105 39 q 5 3 0 6" />
  </svg>;
}

// How far along the reel this fish is: one dot per turn, filled as they go.
function ReelMeter({ step }) {
  return <span className="reel-meter" aria-hidden="true">
    {Array.from({ length: REEL_STEPS }, (_, index) => (
      <span className={`reel-dot${index < step ? ' filled' : ''}`} key={index} />
    ))}
  </span>;
}

export function FishSprite({ fish, onTap }) {
  const word = fishWord(fish);
  const { x, y } = fishPosition(fish);
  const swimming = fish.status === 'swim';
  const onLine = fish.status === 'hooked';
  const aboard = fish.status === 'aboard';
  const busy = fish.status === 'delivered';
  const className = `fish fish-${fish.color} fish-${fish.status}${busy ? ' is-away' : ''}`;

  return <div className={className} style={{ left: `${x}%`, top: `${y}%`, '--dir': fish.dir }}>
    {busy
      ? <span className="fish-art"><FishArt /></span>
      : <button
        type="button"
        className="fish-art"
        onClick={() => onTap(fish)}
        aria-label={swimming
          ? `Fisk som bærer ordet ${word} – trykk for å feste kroken`
          : `Sveiv inn fisken med ordet ${word} – ${fish.reelStep} av ${REEL_STEPS}`}
      >
        <FishArt />
      </button>}

    {swimming && <span className="fish-tag" aria-hidden="true">{word}</span>}
    {onLine && <ReelMeter step={fish.reelStep} />}
    {aboard && <span className="aboard-mark" aria-hidden="true">🎣</span>}
  </div>;
}
