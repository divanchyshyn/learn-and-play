import { tone, setMuted } from '../../shared/audio.js';

// The shop's own sound character – effect definitions stay with the game,
// the Web Audio engine comes from src/shared. Selecting goods speaks their
// Norwegian names (see speech.js), so there are no click blips on items.
export const sounds = {
  select() {
    tone({ freq: 660, duration: 0.09, type: 'sine', volume: 0.16 });
  },
  success() {
    [660, 830].forEach((freq, index) => tone({ freq, delay: index * 0.09, duration: 0.14, volume: 0.16 }));
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((freq, index) => tone({ freq, delay: index * 0.11, duration: 0.24, type: 'triangle', volume: 0.15 }));
  },
  whistle() {
    // A short two-tone referee whistle for the cheating-check policeman.
    tone({ freq: 2100, duration: 0.16, type: 'square', volume: 0.1 });
    tone({ freq: 1750, delay: 0.15, duration: 0.24, type: 'square', volume: 0.1 });
  },
};

export { setMuted };
