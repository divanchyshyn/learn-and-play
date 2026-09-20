import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isMuted, setMuted, sounds } from './sounds.js';

describe('word-fishing sound settings', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('starts unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists the mute setting to localStorage', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('wordFishing:muted')).toBe('1');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('wordFishing:muted')).toBe('0');
  });

  it('treats every effect as a safe no-op without Web Audio or when muted', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => {
      sounds.hook();
      sounds.reel();
      sounds.plop();
      sounds.crate();
      sounds.escape();
      sounds.newWord();
      sounds.blub();
      sounds.select();
      sounds.stamp();
      sounds.fanfare();
    }).not.toThrow();

    setMuted(true);
    expect(() => sounds.fanfare()).not.toThrow();
  });

  it('adopts a sound setting saved under the game\'s old name', async () => {
    window.localStorage.clear();
    window.localStorage.setItem('ordfiske:muted', '1');
    vi.resetModules();

    const fresh = await import('./sounds.js');

    expect(window.localStorage.getItem('wordFishing:muted')).toBe('1');
    expect(window.localStorage.getItem('ordfiske:muted')).toBeNull();
    expect(fresh.isMuted()).toBe(true);
    window.localStorage.clear();
  });
});
