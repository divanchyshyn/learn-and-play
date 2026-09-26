import { tone, setMuted } from '../../shared/audio.js';

// Kortkrigen's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared.
export const sounds = {
  select() {
    tone({ freq: 620, duration: 0.07, type: 'triangle', volume: 0.14 });
  },
  // A wrong card is only ever a nudge: two soft falling notes, never a buzzer.
  wrong() {
    tone({ freq: 320, freqEnd: 240, duration: 0.16, type: 'triangle', volume: 0.11 });
    tone({ freq: 250, freqEnd: 190, delay: 0.1, duration: 0.18, type: 'sine', volume: 0.1 });
  },
  correct() {
    [523, 659, 784].forEach((freq, index) => tone({ freq, delay: index * 0.08, duration: 0.18, type: 'triangle', volume: 0.15 }));
  },
  // The extra sparkle for a riddle solved without a wrong try.
  medal() {
    [659, 784, 988, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.1, duration: 0.22, type: 'triangle', volume: 0.15 }));
  },
};

export { setMuted };
