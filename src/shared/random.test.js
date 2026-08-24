import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickOne, shuffle } from './random.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffle', () => {
  it('returns the same items in a new array without touching the input', () => {
    const input = [1, 2, 3];
    const output = shuffle(input);
    expect(input).toEqual([1, 2, 3]);
    expect(output).not.toBe(input);
    expect([...output].sort()).toEqual([1, 2, 3]);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['bare'])).toEqual(['bare']);
  });

  it('follows Fisher–Yates exactly under a pinned random source', () => {
    // Consumed back-to-front: index 2 uses 0, index 1 uses 0.3.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.3);
    expect(shuffle(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });
});

describe('pickOne', () => {
  it('always returns an item from the given list', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      expect(['en', 'to', 'tre']).toContain(pickOne(['en', 'to', 'tre']));
    }
  });

  it('maps a pinned random value onto the expected item', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickOne(['x', 'y'])).toBe('x');
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickOne(['x', 'y'])).toBe('y');
  });

  it('returns the only item of a single-element list', () => {
    expect(pickOne(['bare'])).toBe('bare');
  });
});
