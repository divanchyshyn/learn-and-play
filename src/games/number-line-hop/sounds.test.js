import { describe, it, expect, beforeEach } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('tierhopp sound settings', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('starts unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists the mute setting to localStorage', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('tierhopp:muted')).toBe('1');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('tierhopp:muted')).toBe('0');
  });

  it('treats every effect as a safe no-op without Web Audio or when muted', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => {
      sounds.hop();
      sounds.land();
      sounds.cheer();
      sounds.select();
    }).not.toThrow();

    setMuted(true);
    expect(() => sounds.cheer()).not.toThrow();
  });
});
