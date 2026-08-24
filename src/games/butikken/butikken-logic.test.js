import { describe, it, expect } from 'vitest';
import { sampleShop, makeOptions, changeDistractions, totalDistractions } from './Butikken.jsx';

describe('butikken shop sampler', () => {
  it('always picks 12 unique items: 6 food, 3 toys, 3 school things', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const shop = sampleShop();
      expect(shop).toHaveLength(12);
      expect(new Set(shop.map((item) => item.id)).size).toBe(12);
      expect(shop.filter((item) => item.category === 'mat')).toHaveLength(6);
      expect(shop.filter((item) => item.category === 'leker')).toHaveLength(3);
      expect(shop.filter((item) => item.category === 'skole')).toHaveLength(3);
    }
  });
});

describe('butikken answer options', () => {
  it('offers exactly four unique non-negative options including the answer', () => {
    for (let trial = 0; trial < 100; trial += 1) {
      const options = makeOptions(30, [30, 40, 20, 25, 31, 45]);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(30);
      expect(options.filter((value) => value === 30)).toHaveLength(1);
      expect(options.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
    }
  });

  it('ignores negative candidates and never duplicates the answer', () => {
    const options = makeOptions(10, [-5, -1, 0, 10, 11]);
    expect(options).toHaveLength(4);
    expect(options).toContain(10);
    expect(options.every((value) => value >= 0)).toBe(true);
    expect(options.filter((value) => value === 10)).toHaveLength(1);
  });

  it('fills up with nearby numbers when no candidates are usable', () => {
    const options = makeOptions(3, [-8, -9]);
    expect(options).toHaveLength(4);
    expect(options).toContain(3);
    expect(new Set(options).size).toBe(4);
    expect(options.every((value) => value >= 0 && Number.isInteger(value))).toBe(true);
  });

  it('seeds change and total distractors with the relevant amounts', () => {
    expect(totalDistractions(30)).toContain(30);

    const distractions = changeDistractions(100, 30, 70);
    expect(distractions).toContain(30);   // the total again
    expect(distractions).toContain(170);  // the whole wallet + the change
    expect(distractions.every((value) => Number.isInteger(value))).toBe(true);
    // The correct answer itself is never seeded – makeOptions adds it.
    expect(distractions).not.toContain(70);
  });
});
