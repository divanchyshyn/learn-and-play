import { crateTally } from './journal.js';
import { crateById } from './words.js';

// The crates the boat carries, lined up in the dock under the water. While a
// fish waits on deck they are the answer buttons – tap the crate the word
// belongs in. The rest of the time they are simply the child's progress: how
// full each crate already is. Nothing here ever fails – a crate that is not the
// right one just means the fish slips back into the water.
export function CrateDock({ trip, journal, aboard, hintCrateId, onPut }) {
  return <div className="crate-dock" role="group" aria-label="Fangstkassene på båten">
    {trip.crates.map((crateId) => {
      const crate = crateById(crateId);
      const { caught, total } = crateTally(journal, crateId);
      const full = caught >= total;
      const classes = ['crate'];
      if (hintCrateId === crateId) classes.push('hint');
      if (full) classes.push('full');
      return <button
        type="button"
        key={crateId}
        className={classes.join(' ')}
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
      </button>;
    })}
  </div>;
}
