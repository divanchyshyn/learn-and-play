import { describe, it, expect, vi } from 'vitest';
import {
  ITEM_BANK, MAX_PER_TRANSACTION, SELLER_START_MONEY,
  sampleShop, makeOptions,
  totalDistractions, sumPrices, itemsFor, POLICE_LINES, pickPoliceLine,
} from './Butikken.jsx';

describe('butikken shop sampler', () => {
  it('always picks 14 unique items: 6 food, 4 toys, 4 school things', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const shop = sampleShop();
      expect(shop).toHaveLength(14);
      expect(new Set(shop.map((item) => item.id)).size).toBe(14);
      expect(shop.filter((item) => item.category === 'mat')).toHaveLength(6);
      expect(shop.filter((item) => item.category === 'leker')).toHaveLength(4);
      expect(shop.filter((item) => item.category === 'skole')).toHaveLength(4);
    }
  });
});

describe('butikken goods bank', () => {
  it('offers the three Donald Duck magazines in thin, medium and thick', () => {
    const donalds = ITEM_BANK.filter((item) => item.name.includes('Donald'));
    expect(donalds.map((item) => item.name).sort()).toEqual([
      'middels Donald-hefte',
      'tykt Donald-hefte',
      'tynt Donald-hefte',
    ]);
    // Thin < medium < thick – the sizes must be distinguishable by price too.
    const [thin, medium, thick] = ['donald-tynn', 'donald-middels', 'donald-tykk']
      .map((id) => ITEM_BANK.find((item) => item.id === id));
    expect(thin.price).toBeLessThan(medium.price);
    expect(medium.price).toBeLessThan(thick.price);
  });

  it('sells a toy airplane and a helicopter', () => {
    for (const name of ['lekefly', 'helikopter']) {
      const item = ITEM_BANK.find((candidate) => candidate.id === name);
      expect(item).toBeTruthy();
      expect(item.category).toBe('leker');
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('keeps ids and names unique with positive whole prices', () => {
    expect(new Set(ITEM_BANK.map((item) => item.id)).size).toBe(ITEM_BANK.length);
    expect(new Set(ITEM_BANK.map((item) => item.name)).size).toBe(ITEM_BANK.length);
    expect(ITEM_BANK.every((item) => Number.isInteger(item.price) && item.price > 0)).toBe(true);
  });
});

describe('butikken trade rules', () => {
  it('caps every transaction at three items', () => {
    expect(MAX_PER_TRANSACTION).toBe(3);
  });

  it('starts the seller with enough money to buy returns back', () => {
    // Three of anything on the shelf must be affordable for the seller.
    const dearestThree = [...ITEM_BANK].sort((a, b) => b.price - a.price).slice(0, MAX_PER_TRANSACTION);
    expect(SELLER_START_MONEY).toBeGreaterThanOrEqual(sumPrices(dearestThree));
  });

  it('sums prices and resolves ids to items', () => {
    const basket = itemsFor(['eple', 'melk']);
    expect(basket.map((item) => item.name)).toEqual(['eple', 'melk']);
    expect(sumPrices(basket)).toBe(8 + 14);
    expect(sumPrices([])).toBe(0);
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

  it('seeds total distractors around the real total', () => {
    expect(totalDistractions(30)).toContain(30);
    expect(totalDistractions(30).every((value) => Number.isInteger(value))).toBe(true);
  });
});

describe('butikken policeman', () => {
  it('has a stock of funny scoldings and only ever picks one of them', () => {
    expect(POLICE_LINES.length).toBeGreaterThanOrEqual(3);
    expect(POLICE_LINES.every((line) => line.length > 5)).toBe(true);
    for (let trial = 0; trial < 50; trial += 1) {
      expect(POLICE_LINES).toContain(pickPoliceLine());
    }
  });

  it('honours an injected random source', () => {
    const random = vi.fn(() => 0); // always the first line
    expect(pickPoliceLine(random)).toBe(POLICE_LINES[0]);
    random.mockReturnValue(0.999);
    expect(pickPoliceLine(random)).toBe(POLICE_LINES[POLICE_LINES.length - 1]);
  });
});
