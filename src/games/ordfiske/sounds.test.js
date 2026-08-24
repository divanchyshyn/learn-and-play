import { describe, it, expect, beforeEach } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('ordfiske sound settings', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('starts unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists the mute setting to localStorage', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('ordfiske:muted')).toBe('1');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('ordfiske:muted')).toBe('0');
  });

  it('treats every effect as a safe no-op without Web Audio or when muted', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => {
      sounds.splash();
      sounds.plop();
      sounds.blub();
      sounds.select();
      sounds.fanfare();
    }).not.toThrow();

    setMuted(true);
    expect(() => sounds.fanfare()).not.toThrow();
  });
});
