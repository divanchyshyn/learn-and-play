import { describe, it, expect, beforeEach } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('lyd-labyrint sound settings', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('starts unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists the mute setting to localStorage', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('lydLabyrint:muted')).toBe('1');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('lydLabyrint:muted')).toBe('0');
  });

  it('treats every effect as a safe no-op without Web Audio or when muted', () => {
    // jsdom has no AudioContext – playing effects must never throw.
    expect(() => {
      sounds.step();
      sounds.thud();
      sounds.open();
      sounds.select();
      sounds.pop();
      sounds.wrong();
      sounds.fanfare();
    }).not.toThrow();

    setMuted(true);
    expect(() => sounds.fanfare()).not.toThrow();
  });
});
