import { crateFull, crateTally } from './journal.js';
import { crateById } from './words.js';

// The crates the boat carries, lined up in the dock under the water. While a
// fish waits on deck they are the answer buttons – tap the crate the word
// belongs in. The rest of the time they are simply the child's progress: how
// full each crate already is, and they say so with their look (see `.crate-dock`
// in style.css), so a tap that cannot do anything never comes as a surprise.
//
// Every catch that lands pops the crate it landed in. `landed.gain` is 1 only
// when the word was new to the fishing book – the crate's own count is a count
// of *different* words, so a word caught again moves nothing else, and the child
// would otherwise be left wondering whether the fish went in at all.
export function CrateDock({ trip, journal, aboard, hintCrateId, landed, onPut }) {
  const classes = ['crate-dock'];
  if (aboard) classes.push('live');
  return <div className={classes.join(' ')} role="group" aria-label="Fangstkassene på båten">
    {trip.crates.map((crateId) => {
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
    })}
  </div>;
}
