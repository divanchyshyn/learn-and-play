import { useCallback, useEffect, useState } from 'react';

// State that is a moment rather than a state: it appears, and after `ms` it is
// gone again. Word Fishing's four little messages - a crate glow, the pop on
// the crate a catch landed in, the nudge under a tap that could not sail, and
// the glow on a treasure that just arrived - are all this one behaviour, and
// each was written out as its own effect with its own timer cleanup.
//
//   const [nudge, showNudge, clearNudge] = useTransientState(NUDGE_MS);
//   showNudge({ text, key: (prev?.key ?? 0) + 1 });
//
// `show(value)` replaces whatever is showing and restarts the clock, so a
// repeated moment is visible again rather than inheriting the first one's
// remaining time. `clear()` takes the moment away at once, for the game's own
// "start something new" actions. The timer is cleared on unmount and whenever
// the value is replaced, so nothing is left running behind a closed game.
export function useTransientState(ms) {
  const [value, setValue] = useState(null);

  const show = useCallback((next) => {
    setValue(next);
  }, []);

  const clear = useCallback(() => {
    setValue(null);
  }, []);

  useEffect(() => {
    if (value === null) return undefined;
    const timer = window.setTimeout(() => setValue(null), ms);
    return () => window.clearTimeout(timer);
    // `value` is the dependency that matters: showing the same object again
    // would not restart the clock, which is why `show` callers pass a fresh
    // value (Word Fishing's nudge carries a key for exactly this reason).
  }, [value, ms]);

  return [value, show, clear];
}
