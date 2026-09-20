import { tone, setMuted } from '../../shared/audio.js';

// Kortkrig's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared.
export const sounds = {
  flip() {
    tone({ freq: 420, duration: 0.06, type: 'triangle', volume: 0.13 });
    tone({ freq: 640, delay: 0.05, duration: 0.09, type: 'triangle', volume: 0.12 });
  },
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.16 });
  },
  // The clash fires on every reveal – the same fun noise no matter who wins.
  clash() {
    tone({ freq: 180, freqEnd: 70, duration: 0.3, type: 'sawtooth', volume: 0.18 });
    tone({ freq: 1200, delay: 0.02, duration: 0.14, type: 'square', volume: 0.08 });
  },
  cheer() {
    [659, 784, 988, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.09, duration: 0.2, type: 'triangle', volume: 0.15 }));
  },
  boing() {
    tone({ freq: 520, freqEnd: 170, duration: 0.26, type: 'square', volume: 0.13 });
    tone({ freq: 780, freqEnd: 260, delay: 0.04, duration: 0.28, type: 'triangle', volume: 0.11 });
    tone({ freq: 990, delay: 0.14, duration: 0.16, type: 'sine', volume: 0.12 });
  },
};

export { setMuted };
