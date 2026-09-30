import { describe, it, expect, afterEach } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('number-line-hop sound settings', () => {
  afterEach(() => {
    // The mute setting lives on the shared audio engine, so leaving it set
    // would decide what the next test file opens with.
    setMuted(false);
  });

  it('remembers the mute setting under the game\u2019s own storage key', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('numberLineHop:muted')).toBe('1');

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('numberLineHop:muted')).toBe('0');
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
