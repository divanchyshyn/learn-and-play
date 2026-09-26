import { fishPosition, fishWord } from './sea.js';
import { FishArt, speciesForWord } from './FishArt.jsx';

// One fish, drawn as SVG so it actually looks like the fish it is: six species
// (see FishArt), each with its own silhouette, fins, pattern and eyes. The colours
// come from the `fish-<colour>` class in style.css, so a new colour is one CSS
// line and nothing binary ever ships with the game; the species comes from the
// word the fish carries, so a fish keeps its shape for its whole visible life.
//
// A fish is never a button any more: it is the world, not a control. What the
// child reads is the word on its tag, and what the child acts on is the water,
// the float and the crank. Every mark here is decorative and hidden from a
// screen reader – the sea's own narration carries the story (see WordFishing).

// The word stays readable while the fish swims, notices the bait and tastes it,
// so the child can see which word is on its way; once the hook bites, the word
// belongs to the catch card instead.
const WORD_VISIBLE = ['swim', 'chasing', 'nibbling', 'biting'];

export function FishSprite({ fish, boat }) {
  const word = fishWord(fish);
  const species = speciesForWord(word);
  const { x, y } = fishPosition(fish, boat);
  const classes = [
    'fish',
    `fish-${fish.color}`,
    `species-${species}`,
    `fish-${fish.status}`,
    fish.status === 'delivered' ? 'is-away' : '',
    fish.escaped || fish.thrown || fish.spat ? 'is-splashing' : '',
  ].filter(Boolean).join(' ');

  return <div className={classes} style={{ left: `${x}%`, top: `${y}%`, '--dir': fish.dir }}>
    <span className="fish-art"><FishArt species={species} /></span>

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
