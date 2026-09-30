import { useState } from 'react';
import { isMuted } from './audio.js';

// The collection's one sound switch. Every game shows the same speaker in its
// control row and remembers the choice the same way (see createMuteStore in
// audio.js) - so the state, the write-back and the little confirmation blip
// live here instead of being written out five times.
//
// It takes the write-back from the game rather than reaching for it:
// `applyMuted` is that game's own setMuted, which createMuteStore has bound to
// the game's storage key. Importing setMuted from the shared engine here would
// write the value with no key at all, and the choice would stop being saved.
//
// `onEnable` is the sound to play when sound is switched back on, so each game
// keeps its own voice (the labyrinth pops, the sea hooks, the shop and the
// meadow click). Switching sound *off* is deliberately silent.
export function useSoundToggle(applyMuted, onEnable) {
  // The engine holds the current state - the game's sounds.js loaded it at
  // import time - so that stays the one source of truth for "is sound on now".
  const [soundOn, setSoundOn] = useState(() => !isMuted());

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    applyMuted(!next);
    if (next) onEnable();
  }

  return { soundOn, toggleSound };
}
