import { isMuted as engineIsMuted, loadMuted, setMuted as setEngineMuted, tone } from '../../shared/audio.js';

const MUTE_STORAGE_KEY = 'ordfiske:muted';

// Ordfiske remembers your mute choice between visits.
loadMuted(MUTE_STORAGE_KEY);

// The pond's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared.
export const sounds = {
  // Fish breaks the surface: a bubbly rising splash.
  splash() {
    tone({ freq: 320, freqEnd: 940, duration: 0.16, type: 'sine', volume: 0.16 });
    tone({ freq: 620, freqEnd: 1240, delay: 0.05, duration: 0.12, type: 'triangle', volume: 0.1 });
  },
  // Happy plop into the bucket: falling blub plus a small sparkle.
  plop() {
    tone({ freq: 520, freqEnd: 210, duration: 0.14, type: 'sine', volume: 0.18 });
    tone({ freq: 880, delay: 0.09, duration: 0.1, type: 'triangle', volume: 0.1 });
  },
  // Neutral little blub for "swims back out" – deliberately tiny and soft.
  blub() {
    tone({ freq: 230, duration: 0.08, type: 'sine', volume: 0.07 });
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.14 });
  },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.1, duration: 0.22, type: 'triangle', volume: 0.14 }));
  },
};

export { engineIsMuted as isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
