import { describe, it, expect } from 'vitest';
import { WORD_BANK, WORD_CATEGORIES, pickWordOrder, drawWordIndex } from './words.js';

describe('ordfiske word bank', () => {
  it('offers a healthy pile of short words', () => {
    expect(WORD_BANK.length).toBeGreaterThanOrEqual(40);
    for (const entry of WORD_BANK) {
      expect(entry.word.length).toBeGreaterThanOrEqual(2);
      expect(entry.word.length).toBeLessThanOrEqual(7);
    }
  });

  it('never repeats a word', () => {
    expect(new Set(WORD_BANK.map((entry) => entry.word)).size).toBe(WORD_BANK.length);
  });

  it('only uses plain lowercase Norwegian letters', () => {
    for (const entry of WORD_BANK) {
      expect(entry.word).toMatch(/^[a-zæøå]+$/);
    }
  });

  it('tags every word with a known category', () => {
    const categories = Object.keys(WORD_CATEGORIES);
    for (const entry of WORD_BANK) {
      expect(categories).toContain(entry.cat);
    }
    // Every category is actually in use, so no dead themes linger.
    for (const category of categories) {
      expect(WORD_BANK.some((entry) => entry.cat === category)).toBe(true);
    }
  });
});

describe('ordfiske word dealing', () => {
  it('deals a shuffled permutation of the whole bank', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const order = pickWordOrder();
      expect(order).toHaveLength(WORD_BANK.length);
      expect([...order].sort((a, b) => a - b)).toEqual(WORD_BANK.map((_, index) => index));
    }
  });

  it('walks the order in sequence when nothing is taken', () => {
    const order = [5, 2, 9];
    expect(drawWordIndex(order, 0, new Set())).toEqual({ index: 5, nextPos: 1 });
    expect(drawWordIndex(order, 1, new Set())).toEqual({ index: 2, nextPos: 2 });
    expect(drawWordIndex(order, 2, new Set())).toEqual({ index: 9, nextPos: 3 });
  });

  it('skips words that are already on screen', () => {
    const order = [0, 1, 2];
    expect(drawWordIndex(order, 0, new Set([0]))).toEqual({ index: 1, nextPos: 2 });
    expect(drawWordIndex(order, 0, new Set([0, 1]))).toEqual({ index: 2, nextPos: 3 });
  });

  it('wraps around after the end of the bank', () => {
    const order = [0, 1, 2];
    expect(drawWordIndex(order, 3, new Set())).toEqual({ index: 0, nextPos: 4 });
  });

  it('falls back gracefully when every word is somehow taken', () => {
    const order = [0, 1, 2];
    const draw = drawWordIndex(order, 0, new Set([0, 1, 2]));
    expect(order).toContain(draw.index);
    expect(draw.nextPos).toBe(4);
  });
});
