import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isMuted, loadMuted, setMuted, tone } from './audio.js';

beforeEach(() => {
  localStorage.clear();
  setMuted(false);
});

afterEach(() => {
  localStorage.clear();
});

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

describe('shared audio engine playback', () => {
  it('is a safe no-op without Web Audio support', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => tone({ freq: 440 })).not.toThrow();
    expect(() => tone({ freq: 220, freqEnd: 110, type: 'sawtooth' })).not.toThrow();
  });

  it('skips playback entirely while muted', () => {
    setMuted(true);
    expect(() => tone({ freq: 440 })).not.toThrow();
  });
});
