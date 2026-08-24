import { tone, setMuted } from '../../shared/audio.js';

// The shop's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared.
export const sounds = {
  pop() {
    tone({ freq: 540, duration: 0.08, type: 'triangle', volume: 0.18 });
    tone({ freq: 880, delay: 0.06, duration: 0.1, type: 'triangle', volume: 0.13 });
  },
  tick() {
    tone({ freq: 290, duration: 0.07, type: 'square', volume: 0.07 });
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.16 });
  },
  success() {
    [660, 830].forEach((freq, index) => tone({ freq, delay: index * 0.09, duration: 0.14, volume: 0.16 }));
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((freq, index) => tone({ freq, delay: index * 0.11, duration: 0.24, type: 'triangle', volume: 0.15 }));
  },
};

export { setMuted };
