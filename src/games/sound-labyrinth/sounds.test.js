import { describe, it, expect, afterEach, vi } from 'vitest';
import { sounds, setMuted, isMuted } from './sounds.js';

describe('sound-labyrinth sound settings', () => {
  afterEach(() => {
    // The mute setting lives on the shared audio engine, so leaving it set would
    // decide what the next test file opens with.
    setMuted(true);
    window.localStorage.clear();
  });

  // This is the one game that opens silent on a fresh page, so the default is
  // worth pinning. It is pinned the way the browser actually produces it - by
  // evaluating the module with an empty storage - rather than by asserting on
  // the state another test happened to leave behind.
  it('opens silent on a fresh page and only speaks once the child turns sound on', async () => {
    window.localStorage.clear();
    vi.resetModules();

    const fresh = await import('./sounds.js');

    expect(fresh.isMuted()).toBe(true);
    expect(window.localStorage.getItem('soundLabyrinth:muted')).toBeNull();
  });

  it('remembers the mute setting under the game\u2019s own storage key', () => {
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('soundLabyrinth:muted')).toBe('0');

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('soundLabyrinth:muted')).toBe('1');
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
