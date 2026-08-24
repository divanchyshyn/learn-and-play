import { isMuted as engineIsMuted, loadMuted, setMuted as setEngineMuted, tone } from '../../shared/audio.js';

const MUTE_STORAGE_KEY = 'tierhopp:muted';

// Tierhopp remembers your mute choice between visits.
loadMuted(MUTE_STORAGE_KEY);

// The meadow's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared.
export const sounds = {
  // Take-off boing: a rising spring.
  hop() {
    tone({ freq: 240, freqEnd: 720, duration: 0.18, type: 'triangle', volume: 0.18 });
    tone({ freq: 480, freqEnd: 960, delay: 0.06, duration: 0.1, type: 'sine', volume: 0.08 });
  },
  // Soft four-paw landing thump.
  land() {
    tone({ freq: 190, freqEnd: 110, duration: 0.14, type: 'sine', volume: 0.16 });
  },
  // The reward beat of every round, however many hops it took.
  cheer() {
    [523, 659, 784, 1047].forEach((freq, index) => tone({ freq, delay: index * 0.09, duration: 0.2, type: 'triangle', volume: 0.15 }));
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.14 });
  },
};

export { engineIsMuted as isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
