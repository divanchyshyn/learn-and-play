let audioCtx = null;
let muted = false;

function context() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone({ freq, freqEnd, delay = 0, duration = 0.12, type = 'sine', volume = 0.15 }) {
  const ctx = context();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

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

export function setMuted(value) {
  muted = value;
}
