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
  // Descending buzz for a wrong spelling – audibly "that was not it".
  wrong() {
    tone({ freq: 233, duration: 0.1, type: 'sawtooth', volume: 0.1 });
    tone({ freq: 175, delay: 0.1, duration: 0.12, type: 'sawtooth', volume: 0.1 });
    tone({ freq: 117, delay: 0.2, duration: 0.2, type: 'sawtooth', volume: 0.1 });
  },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((freq, index) => tone({ freq, delay: index * 0.1, duration: 0.22, type: 'triangle', volume: 0.14 }));
  },
  // A bright little arpeggio for the moment a maze gives up its puzzle piece.
  pieceEarned() {
    tone({ freq: 523, duration: 0.1, type: 'triangle', volume: 0.14 });
    tone({ freq: 659, delay: 0.09, duration: 0.12, type: 'triangle', volume: 0.14 });
    tone({ freq: 784, delay: 0.18, duration: 0.2, type: 'triangle', volume: 0.15 });
  },
  // A soft pop when a piece clicks into place on the picture board.
  piecePlaced() {
    tone({ freq: 587, duration: 0.08, type: 'sine', volume: 0.14 });
    tone({ freq: 880, delay: 0.05, duration: 0.12, type: 'sine', volume: 0.12 });
  },
  // The longest fanfare of the game: the full picture just came together.
  puzzleDone() {
    [523, 659, 784, 1047, 1319, 1568].forEach((freq, index) => tone({ freq, delay: index * 0.11, duration: 0.25, type: 'triangle', volume: 0.15 }));
  },
};

export { isMuted };

export function setMuted(value) {
  setEngineMuted(value, MUTE_STORAGE_KEY);
}
