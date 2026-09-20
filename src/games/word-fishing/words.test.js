import { describe, it, expect } from 'vitest';
import {
  ALL_CRATES, CATEGORY_CRATE_IDS, CRATE_TARGET, LENGTH_CRATE_IDS, SHORT_WORD_MAX,
  TARGET_WORD_COUNT, WORD_BANK, WORD_CATEGORIES, WORD_COUNT, categoryForWord, crateById,
  crateTarget, crateWordCount, drawWordIndexWhere, isWordInBank, pickWordOrder, wordsInCrate,
} from './words.js';

describe('word-fishing word bank', () => {
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
    expect(categoryForWord(WORD_BANK[0].word)).toBe(WORD_BANK[0].cat);
    expect(categoryForWord('finnesikke')).toBeNull();
    expect(isWordInBank(WORD_BANK[0].word)).toBe(true);
    expect(isWordInBank('finnesikke')).toBe(false);
  });

  it('fills all four pools equally, with the same ten-word target above them', () => {
    expect(CATEGORY_CRATE_IDS).toHaveLength(4);
    const counts = CATEGORY_CRATE_IDS.map((id) => crateWordCount(id));
    expect(new Set(counts).size).toBe(1);
    // Twenty words in every pool: eighty words available, and the same ten to
    // collect in each crate – a balanced goal a child can actually finish.
    expect(counts).toEqual([20, 20, 20, 20]);
    expect(WORD_COUNT).toBe(80);
    for (const crateId of CATEGORY_CRATE_IDS) expect(crateTarget(crateId)).toBe(CRATE_TARGET);
    expect(TARGET_WORD_COUNT).toBe(CRATE_TARGET * CATEGORY_CRATE_IDS.length);
    expect(TARGET_WORD_COUNT).toBeLessThan(WORD_COUNT);
    expect(wordsInCrate(CATEGORY_CRATE_IDS[0])).toHaveLength(counts[0]);
  });

  it('gives the length crates no target of their own', () => {
    expect(CRATE_TARGET).toBe(10);
    for (const crateId of LENGTH_CRATE_IDS) expect(crateTarget(crateId)).toBe(0);
  });
});

describe('word-fishing crates', () => {
  it('describes every crate the boat can carry', () => {
    for (const id of [...CATEGORY_CRATE_IDS, ...LENGTH_CRATE_IDS]) {
      const crate = crateById(id);
      expect(crate.id).toBe(id);
      expect(crate.label.length).toBeGreaterThan(1);
      expect(crate.icon.length).toBeGreaterThan(0);
      expect(['category', 'length']).toContain(crate.kind);
    }
    expect(crateById('finnesikke')).toBeNull();
    expect(ALL_CRATES).toHaveLength(CATEGORY_CRATE_IDS.length + LENGTH_CRATE_IDS.length);
  });

  it('gives the length trip two crates that both have words to work with', () => {
    const short = WORD_BANK.filter((entry) => entry.word.length <= SHORT_WORD_MAX);
    const long = WORD_BANK.filter((entry) => entry.word.length > SHORT_WORD_MAX);
    expect(short.length).toBeGreaterThanOrEqual(5);
    expect(long.length).toBeGreaterThanOrEqual(5);
    expect(short.length + long.length).toBe(WORD_COUNT);
  });
});

describe('word-fishing word dealing', () => {
  it('deals a shuffled permutation of the whole bank', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const order = pickWordOrder();
      expect(order).toHaveLength(WORD_BANK.length);
      expect([...order].sort((a, b) => a - b)).toEqual(WORD_BANK.map((_, index) => index));
    }
  });

  it('walks the order in sequence when nothing is taken', () => {
    const order = [5, 2, 9];
    const any = () => true;
    expect(drawWordIndexWhere(order, 0, new Set(), any)).toEqual({ index: 5, nextPos: 1 });
    expect(drawWordIndexWhere(order, 1, new Set(), any)).toEqual({ index: 2, nextPos: 2 });
    expect(drawWordIndexWhere(order, 2, new Set(), any)).toEqual({ index: 9, nextPos: 3 });
  });

  it('skips words that are already on screen', () => {
    const order = [0, 1, 2];
    const any = () => true;
    expect(drawWordIndexWhere(order, 0, new Set([0]), any)).toEqual({ index: 1, nextPos: 2 });
    expect(drawWordIndexWhere(order, 0, new Set([0, 1]), any)).toEqual({ index: 2, nextPos: 3 });
  });

  it('wraps around after the end of the bank', () => {
    const order = [0, 1, 2];
    expect(drawWordIndexWhere(order, 3, new Set(), () => true)).toEqual({ index: 0, nextPos: 4 });
  });

  it('hands out nothing when every word is somehow taken', () => {
    const order = [0, 1, 2];
    expect(drawWordIndexWhere(order, 0, new Set([0, 1, 2]), () => true)).toEqual({ index: null, nextPos: 3 });
  });

  it('draws only words a filter allows, and still avoids duplicates', () => {
    const order = [0, 1, 2, 3];
    const allowed = (index) => index % 2 === 0;
    expect(drawWordIndexWhere(order, 0, new Set([0]), allowed)).toEqual({ index: 2, nextPos: 3 });
    expect(drawWordIndexWhere(order, 1, new Set(), allowed)).toEqual({ index: 2, nextPos: 3 });
    expect(drawWordIndexWhere(order, 2, new Set([2]), allowed)).toEqual({ index: 0, nextPos: 5 });
  });

  it('hands out nothing when a filter allows none of them', () => {
    // The sea relies on this: a word no filter allows – say, every word it
    // could carry is already in the book – must not be shown at all.
    const order = [0, 1, 2];
    expect(drawWordIndexWhere(order, 0, new Set(), () => false)).toEqual({ index: null, nextPos: 3 });
    expect(drawWordIndexWhere(order, 1, new Set([2]), (index) => index === 2)).toEqual({ index: null, nextPos: 4 });
  });
});
