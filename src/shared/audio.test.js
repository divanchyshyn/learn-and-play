import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMuteStore, isMuted, loadMuted, setMuted, tone } from './audio.js';

beforeEach(() => {
  localStorage.clear();
  setMuted(false);
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

// The engine keeps one AudioContext for the whole page, so a test that wants
// the engine to build its context from a stub it just installed has to load the
// module fresh. Playback tests below use this instead of the static import.
async function freshAudioModule() {
  vi.resetModules();
  return import('./audio.js');
}

// A stand-in for a browser's Web Audio implementation: just enough of the
// graph to record that a blip was built, and to prove the engine reads the
// context's own clock rather than wall time.
function fakeAudioContext() {
  const calls = { started: 0, stopped: 0, resumed: 0, connected: 0 };
  const param = () => ({
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  });
  const context = {
    state: 'running',
    currentTime: 1.5,
    destination: { kind: 'destination' },
    calls,
    createOscillator: () => ({
      type: null,
      frequency: param(),
      connect: () => ({ connect: () => { calls.connected += 1; } }),
      start: () => { calls.started += 1; },
      stop: () => { calls.stopped += 1; },
    }),
    createGain: () => ({ gain: param(), connect: () => ({ connect: () => {} }) }),
    resume: () => { calls.resumed += 1; return Promise.resolve(); },
  };
  return context;
}

describe('shared audio engine mute state', () => {
  it('starts unmuted and toggles in memory', () => {
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('persists the choice only when a storage key is given', () => {
    setMuted(true);
    expect(localStorage.getItem('test:muted')).toBeNull();

    setMuted(true, 'test:muted');
    expect(localStorage.getItem('test:muted')).toBe('1');

    setMuted(false, 'test:muted');
    expect(localStorage.getItem('test:muted')).toBe('0');
  });

  it('restores a persisted choice at startup', () => {
    localStorage.setItem('test:muted', '1');
    expect(loadMuted('test:muted')).toBe(true);
    expect(isMuted()).toBe(true);

    loadMuted('other:key');
    expect(isMuted()).toBe(false); // nothing stored under that key
  });

  it('applies the provided fallback when nothing is stored', () => {
    expect(loadMuted('fallback:muted', true)).toBe(true);
    expect(isMuted()).toBe(true);

    // A stored choice still wins over the fallback.
    localStorage.setItem('fallback:muted', '0');
    expect(loadMuted('fallback:muted', true)).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it('treats junk storage values as unmuted', () => {
    localStorage.setItem('test:muted', 'yes');
    expect(loadMuted('test:muted')).toBe(false);
  });
});

// Every game binds its mute setting to its own key through this one factory, so
// the key, the default and the legacy-key adoption are the contract worth
// pinning here rather than five times over in the games' own tests.
describe('shared audio engine per-game mute stores', () => {
  it('reads, remembers and restores under its own key', () => {
    const store = createMuteStore({ storageKey: 'game:muted' });

    expect(store.isMuted()).toBe(false);
    store.setMuted(true);
    expect(store.isMuted()).toBe(true);
    expect(localStorage.getItem('game:muted')).toBe('1');

    // A second store for the same key reads the value straight back, which is
    // what a page reload does.
    expect(createMuteStore({ storageKey: 'game:muted' }).isMuted()).toBe(true);
  });

  it('opens silent only when nothing was ever stored', () => {
    const store = createMuteStore({ storageKey: 'quiet:muted', fallback: true });
    expect(store.isMuted()).toBe(true);

    // A child who turns the sound on keeps it on across visits.
    store.setMuted(false);
    expect(createMuteStore({ storageKey: 'quiet:muted', fallback: true }).isMuted()).toBe(false);
  });

  it('adopts a value saved under the game\u2019s old key exactly once', () => {
    localStorage.setItem('oldName:muted', '1');
    const store = createMuteStore({ storageKey: 'newName:muted', legacyKey: 'oldName:muted' });

    expect(store.isMuted()).toBe(true);
    expect(localStorage.getItem('newName:muted')).toBe('1');
    expect(localStorage.getItem('oldName:muted')).toBeNull();
  });

  it('does not let one game\u2019s choice leak into another game', () => {
    createMuteStore({ storageKey: 'game-one:muted' }).setMuted(true);
    expect(createMuteStore({ storageKey: 'game-two:muted' }).isMuted()).toBe(false);
    expect(createMuteStore({ storageKey: 'game-one:muted' }).isMuted()).toBe(true);
  });
});

describe('shared audio engine playback', () => {
  it('is a safe no-op without Web Audio support', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => tone({ freq: 440 })).not.toThrow();
    expect(() => tone({ freq: 220, freqEnd: 110, type: 'sawtooth' })).not.toThrow();
  });

  it('builds a blip from the context clock and releases the oscillator', async () => {
    const context = fakeAudioContext();
    vi.stubGlobal('AudioContext', function AudioContext() { return context; });
    const { tone: freshTone } = await freshAudioModule();

    freshTone({ freq: 440, freqEnd: 880, delay: 0.1, duration: 0.2, type: 'triangle', volume: 0.2 });

    expect(context.calls.started).toBe(1);
    // The oscillator is stopped past its own duration, so it never keeps
    // playing after the blip is over.
    expect(context.calls.stopped).toBe(1);
    expect(context.calls.connected).toBe(1);
  });

  it('resumes a suspended context before playing', async () => {
    const context = fakeAudioContext();
    context.state = 'suspended';
    vi.stubGlobal('AudioContext', function AudioContext() { return context; });
    const { tone: freshTone } = await freshAudioModule();

    freshTone({ freq: 440 });

    expect(context.calls.resumed).toBe(1);
    expect(context.calls.started).toBe(1);
  });

  it('skips playback entirely while muted', async () => {
    const context = fakeAudioContext();
    vi.stubGlobal('AudioContext', function AudioContext() { return context; });
    const fresh = await freshAudioModule();
    fresh.setMuted(true);

    fresh.tone({ freq: 440 });

    expect(context.calls.started).toBe(0);
  });
});
