import { fishPosition, fishWord } from './sea.js';

// One fish, drawn as SVG so it actually looks like a fish: forked tail, dorsal
// and pectoral fins, a gill line and a proper eye. The colours come from the
// `fish-<colour>` class in style.css, so a new colour is one CSS line and
// nothing binary ever ships with the game.
//
// A fish is never a button any more: it is the world, not a control. What the
// child reads is the word on its tag, and what the child acts on is the water,
// the float and the crank. Every mark here is decorative and hidden from a
// screen reader – the sea's own narration carries the story (see WordFishing).
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

// The word stays readable while the fish swims, notices the bait and tastes it,
// so the child can see which word is on its way; once the hook bites, the word
// belongs to the catch card instead.
const WORD_VISIBLE = ['swim', 'chasing', 'nibbling', 'biting'];

export function FishSprite({ fish, boat }) {
  const word = fishWord(fish);
  const { x, y } = fishPosition(fish, boat);
  const classes = [
    'fish',
    `fish-${fish.color}`,
    `fish-${fish.status}`,
    fish.status === 'delivered' ? 'is-away' : '',
    fish.escaped || fish.thrown || fish.spat ? 'is-splashing' : '',
  ].filter(Boolean).join(' ');

  return <div className={classes} style={{ left: `${x}%`, top: `${y}%`, '--dir': fish.dir }}>
    <span className="fish-art"><FishArt /></span>

    {WORD_VISIBLE.includes(fish.status) && <span className="fish-tag" aria-hidden="true">{word}</span>}

    {/* It has noticed the bait and is coming over. */}
    {fish.status === 'chasing' && <span className="fish-mark chase-mark" aria-hidden="true">!</span>}
    {/* It is tasting the bait – and then the float goes under. */}
    {(fish.status === 'nibbling' || fish.status === 'biting') && <span className="fish-bubbles" aria-hidden="true">{'°◦'}</span>}
    {fish.status === 'biting' && <span className="fish-mark bite-mark" aria-hidden="true">❗</span>}
    {fish.status === 'aboard' && <span className="aboard-mark" aria-hidden="true">🎣</span>}
    {(fish.escaped || fish.thrown || fish.spat) && <span className="fish-splash" aria-hidden="true" />}
  </div>;
}
