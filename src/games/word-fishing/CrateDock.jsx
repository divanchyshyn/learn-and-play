import { crateFull, crateTally } from './journal.js';
import { crateById } from './words.js';

// The crates the boat carries, and the one control, in a single row under the water:
// two crates, the control, two crates.
//
// While a fish waits on deck the crates are the answer buttons – tap the crate the
// word belongs in. The rest of the time they are simply the child's progress: how
// full each crate already is, and they say so with their look (see `.crate-dock`
// in style.css), so a tap that cannot do anything never comes as a surprise.
//
// The control is handed in rather than drawn here – it changes with the stage of the
// trip – and it takes the place between the second crate and the third: this row is
// where a child's thumb already is, and the water above it stays art, so no control
// can ever stand over a find (see the layout note on `.crate-dock`).
//
// Every catch that lands pops the crate it landed in. `landed.gain` is 1 only
// when the word was new to the fishing book – the crate's own count is a count
// of *different* words, so a word caught again moves nothing else, and the child
// would otherwise be left wondering whether the fish went in at all.
export function CrateDock({ trip, journal, aboard, hintCrateId, landed, onPut, control }) {
  const classes = ['crate-dock'];
  if (aboard) classes.push('live');
  const crates = trip.crates.map((crateId) => {
    const crate = crateById(crateId);
    const { caught, total } = crateTally(journal, crateId);
    const full = crateFull(journal, crateId);
    const crateClasses = ['crate'];
    if (hintCrateId === crateId) crateClasses.push('hint');
    if (full) crateClasses.push('full');
    if (landed && landed.crateId === crateId) crateClasses.push('landed');
    return <button
      type="button"
      key={crateId}
      className={crateClasses.join(' ')}
      disabled={!aboard}
      aria-label={aboard
        ? `Legg fisken i kassen ${crate.label}`
        : `Kassen ${crate.label}: ${caught} av ${total} ord`}
      onClick={() => onPut(crateId)}
    >
      <span className="crate-lid" aria-hidden="true" />
      <span className="crate-icon" aria-hidden="true">{crate.icon}</span>
      <span className="crate-label">{crate.label}</span>
      <span className="crate-count">{caught} av {total}</span>
      {full && <span className="crate-star" aria-hidden="true">⭐</span>}
      {landed && landed.crateId === crateId && <span className="crate-landing" key={landed.key} aria-hidden="true">
        <span className="crate-fish">🐟</span>
        {landed.gain === 1 && <span className="crate-gain">+1</span>}
      </span>}
    </button>;
  });
  return <div className={classes.join(' ')} role="group" aria-label="Fangstkassene og fiskestanga">
    {crates.slice(0, 2)}
    {control}
    {crates.slice(2)}
  </div>;
}
