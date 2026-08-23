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

function tone({ freq, delay = 0, duration = 0.12, type = 'sine', volume = 0.15 }) {
  const ctx = context();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

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

export function setMuted(value) {
  muted = value;
}
