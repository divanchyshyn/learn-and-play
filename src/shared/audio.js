// One Web Audio engine for the whole collection. Each game keeps its own
// sound *definitions* (they are part of that game's character) in its local
// sounds.js and builds them on top of `tone` from here.
import { migrateStorage } from './persistence.js';

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

// A short synthesised blip. Safe no-op without Web Audio support or while
// muted, so games never crash in restricted browsers or tests.
export function tone({ freq, freqEnd, delay = 0, duration = 0.12, type = 'sine', volume = 0.15 }) {
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

export function isMuted() {
  return muted;
}

// Pass a storageKey to remember the choice across visits; without one the
// setting lasts for this session only.
export function setMuted(value, storageKey) {
  muted = Boolean(value);
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, muted ? '1' : '0');
  } catch {
    // Private mode etc. – muting still works for this session.
  }
}

// Restore a persisted mute choice at startup. `fallback` decides the state
// when nothing has been stored yet (or storage is unavailable), so a game can
// choose to open silent. Returns the restored state.
export function loadMuted(storageKey, fallback = false) {
  if (!storageKey || typeof window === 'undefined') return muted;
  try {
    const stored = window.localStorage.getItem(storageKey);
    muted = stored === null ? fallback : stored === '1';
  } catch {
    muted = fallback;
  }
  return muted;
}

// A game's mute setting, bound to its own storage key. One call at the top of a
// game's sounds.js replaces the hand-written load/migrate/set dance, so every
// game in the collection remembers the choice the same way – the only thing
// that differs between games is the key and the default:
//
//   const mute = createMuteStore({ storageKey: 'shop:muted' });
//   export const { isMuted, setMuted } = mute;
//
// `legacyKey` adopts a value saved under an old key once (see migrateStorage),
// so the English-slug renames never cost a child their sound setting. A game
// that opens silent passes `fallback: true`, which is only read when nothing
// has been stored yet – a stored choice always wins.
//
// This reads the saved value immediately, so import order in a game's sounds.js
// does not matter, and calling it again for the same key re-reads rather than
// resetting.
export function createMuteStore({ storageKey, legacyKey, fallback = false } = {}) {
  if (legacyKey && storageKey && legacyKey !== storageKey) {
    migrateStorage(legacyKey, storageKey);
  }
  loadMuted(storageKey, fallback);
  return {
    isMuted,
    setMuted: (value) => setMuted(value, storageKey),
    storageKey,
  };
}
