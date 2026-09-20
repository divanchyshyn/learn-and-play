import { describe, it, expect } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('lyd-labyrint sound settings', () => {
  it('starts muted by default and only speaks once the child turns sound on', () => {
    // The module init reads an empty storage on a fresh page and opens silent.
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('lydLabyrint:muted')).toBeNull();
  });

  it('persists the mute setting to localStorage', () => {
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('lydLabyrint:muted')).toBe('0');

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('lydLabyrint:muted')).toBe('1');
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
