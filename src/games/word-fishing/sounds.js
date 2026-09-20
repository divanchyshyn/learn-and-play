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
};

export { engineIsMuted as isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
