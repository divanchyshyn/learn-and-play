import { isMuted, loadMuted, setMuted as setEngineMuted, tone } from '../../shared/audio.js';

const MUTE_STORAGE_KEY = 'lydLabyrint:muted';

// The labyrinth remembers your mute choice between visits.
loadMuted(MUTE_STORAGE_KEY);

// Lyd-labyrinten's own sound character – effect definitions stay with the
// game, the Web Audio engine comes from src/shared.
export const sounds = {
  step() {
    tone({ freq: 220, duration: 0.05, type: 'triangle', volume: 0.08 });
    tone({ freq: 165, delay: 0.03, duration: 0.05, type: 'sine', volume: 0.06 });
  },
  thud() {
    tone({ freq: 120, duration: 0.11, type: 'sine', volume: 0.1 });
  },
  open() {
    tone({ freq: 392, duration: 0.1, type: 'triangle', volume: 0.13 });
    tone({ freq: 523, delay: 0.09, duration: 0.16, type: 'triangle', volume: 0.15 });
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.14 });
  },
  pop() {
    tone({ freq: 540, duration: 0.08, type: 'triangle', volume: 0.16 });
    tone({ freq: 880, delay: 0.06, duration: 0.1, type: 'triangle', volume: 0.12 });
  },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.1, duration: 0.22, type: 'triangle', volume: 0.14 }));
  },
};

export { isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
