import { isMuted as engineIsMuted, loadMuted, setMuted as setEngineMuted, tone } from '../../shared/audio.js';
import { migrateStorage } from '../../shared/persistence.js';

const MUTE_STORAGE_KEY = 'wordFishing:muted';
// The mute choice used to be saved under the game's old Norwegian name; adopt
// it once so nobody loses their sound setting to the rename.
const LEGACY_MUTE_STORAGE_KEY = 'ordfiske:muted';
migrateStorage(LEGACY_MUTE_STORAGE_KEY, MUTE_STORAGE_KEY);

// Word Fishing remembers your mute choice between visits.
loadMuted(MUTE_STORAGE_KEY);

// The sea's own sound character – effect definitions stay with the game, the
// Web Audio engine comes from src/shared.
export const sounds = {
  // A fish takes the hook and the float dunks: a bubbly rising splash.
  hook() {
    tone({ freq: 300, freqEnd: 820, duration: 0.15, type: 'sine', volume: 0.16 });
    tone({ freq: 640, freqEnd: 1180, delay: 0.04, duration: 0.11, type: 'triangle', volume: 0.09 });
  },
  // One turn of the reel – a short, dry click.
  reel() {
    tone({ freq: 780, duration: 0.05, type: 'square', volume: 0.05 });
  },
  // The fish lands on deck: a happy plop with a small sparkle.
  plop() {
    tone({ freq: 520, freqEnd: 210, duration: 0.14, type: 'sine', volume: 0.18 });
    tone({ freq: 880, delay: 0.09, duration: 0.1, type: 'triangle', volume: 0.1 });
  },
  // The catch lands in its crate: a soft wooden thump.
  crate() {
    tone({ freq: 380, freqEnd: 160, duration: 0.16, type: 'triangle', volume: 0.15 });
  },
  // A word nobody has caught before – three rising notes.
  newWord() {
    [880, 1174, 1568].forEach((freq, index) => tone({ freq, delay: index * 0.07, duration: 0.16, type: 'triangle', volume: 0.11 }));
  },
  // The boat sets off: a low, calm swell.
  sail() {
    tone({ freq: 180, freqEnd: 270, duration: 0.32, type: 'sine', volume: 0.1 });
  },
  // The bait is cast: a soft whoosh out over the water.
  cast() {
    tone({ freq: 900, freqEnd: 320, duration: 0.2, type: 'sine', volume: 0.12 });
  },
  // The bait lands: a round little plop with a small ring on top of it.
  splash() {
    tone({ freq: 420, freqEnd: 190, duration: 0.16, type: 'sine', volume: 0.16 });
    tone({ freq: 760, freqEnd: 400, delay: 0.03, duration: 0.1, type: 'triangle', volume: 0.08 });
  },
  // A fish takes a nibble at the bait: two tiny, close taps.
  nibble() {
    tone({ freq: 300, duration: 0.05, type: 'sine', volume: 0.1 });
    tone({ freq: 340, delay: 0.07, duration: 0.05, type: 'sine', volume: 0.08 });
  },
  // The float goes under: one clear, bright call – the signal to strike.
  bite() {
    tone({ freq: 620, freqEnd: 1180, duration: 0.18, type: 'triangle', volume: 0.18 });
    tone({ freq: 1240, delay: 0.1, duration: 0.16, type: 'sine', volume: 0.12 });
  },
  // The line snaps: a sharp downward flick, playful rather than sad. It only
  // means the fish swims on and the line can be cast again.
  snap() {
    tone({ freq: 700, freqEnd: 150, duration: 0.2, type: 'square', volume: 0.1 });
    tone({ freq: 1100, freqEnd: 300, delay: 0.05, duration: 0.14, type: 'sine', volume: 0.08 });
  },
  // Neutral little blub for "the fish swims on" – deliberately tiny and soft.
  blub() {
    tone({ freq: 230, duration: 0.08, type: 'sine', volume: 0.07 });
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.14 });
  },
  // A stamp lands in the fishing book.
  stamp() {
    tone({ freq: 210, duration: 0.07, type: 'square', volume: 0.1 });
  },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.1, duration: 0.22, type: 'triangle', volume: 0.14 }));
  },
  // A treasure arriving on the seabed: a bubble rising, then a bright little
  // chime on top of it. It plays just after the trip's fanfare, so the two read
  // as one moment – the trip is over, and look what it left behind.
  discovery() {
    tone({ freq: 300, freqEnd: 760, duration: 0.24, type: 'sine', volume: 0.1 });
    [784, 1047, 1319, 1568].forEach((freq, index) => tone({
      freq, delay: 0.2 + index * 0.08, duration: 0.22, type: 'triangle', volume: 0.12,
    }));
  },
};

export { engineIsMuted as isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
