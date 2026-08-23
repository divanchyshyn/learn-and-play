let audioCtx = null;
let muted = false;

try {
  muted = window.localStorage.getItem('lydLabyrint:muted') === '1';
} catch {
  muted = false;
}

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

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    window.localStorage.setItem('lydLabyrint:muted', value ? '1' : '0');
  } catch {
    // Private mode etc. – muting still works for this session.
  }
}
