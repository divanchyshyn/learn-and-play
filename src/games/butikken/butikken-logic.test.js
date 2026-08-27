import { describe, it, expect, vi } from 'vitest';
import {
  ITEM_BANK, MAX_PER_TRANSACTION, SELLER_START_MONEY, START_MONEY, MAX_ATTEMPTS,
  sampleShop, expectedAnswer, checkoutCopy,
  sumPrices, itemsFor, POLICE_LINES, pickPoliceLine,
} from './Butikken.jsx';

describe('butikken shop sampler', () => {
  it('always picks 15 unique items: 7 food, 4 toys, 4 school things', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const shop = sampleShop();
      expect(shop).toHaveLength(15);
      expect(new Set(shop.map((item) => item.id)).size).toBe(15);
      expect(shop.filter((item) => item.category === 'mat')).toHaveLength(7);
      expect(shop.filter((item) => item.category === 'leker')).toHaveLength(4);
      expect(shop.filter((item) => item.category === 'skole')).toHaveLength(4);
    }
  });
});

describe('butikken goods bank', () => {
  it('sells a single Donald Duck magazine with a duck icon', () => {
    const donald = ITEM_BANK.find((item) => item.id === 'donald');
    expect(donald).toBeTruthy();
    expect(donald.emoji).toBe('🦆');
    expect(donald.category).toBe('skole');
    // Only one Donald exists now – the tynn/middels/tykk trio is gone.
    expect(ITEM_BANK.filter((item) => item.name.toLowerCase().includes('donald'))).toHaveLength(1);
    expect(ITEM_BANK.some((item) => item.name.includes('hefte'))).toBe(false);
  });

  it('keeps two-digit prices friendly: ones digit never above 5', () => {
    for (const item of ITEM_BANK) {
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      if (item.price >= 10) {
        expect(item.price % 10).toBeLessThanOrEqual(5);
      }
    }
  });

  it('sells a toy airplane and a helicopter', () => {
    for (const name of ['fly', 'helikopter']) {
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

  it('starts the customer and seller with their purses', () => {
    expect(START_MONEY).toBe(900);
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it('starts the seller with an empty till that fills as goods are bought', () => {
    // The seller starts with nothing; they only gain money when the customer buys.
    expect(SELLER_START_MONEY).toBe(0);
  });

  it('sums prices and resolves ids to items', () => {
    const basket = itemsFor(['eple', 'melk']);
    expect(basket.map((item) => item.name)).toEqual(['eple', 'melk']);
    expect(sumPrices(basket)).toBe(8 + 14);
    expect(sumPrices([])).toBe(0);
  });
});

describe('butikken checkout answer', () => {
  it('works out a single-item purchase as a subtraction from the money you hold', () => {
    const apple = ITEM_BANK.find((item) => item.id === 'eple');
    expect(expectedAnswer('buy', 100, [apple])).toBe(100 - apple.price);
  });

  it('works out a single-item return as an addition to the money you hold', () => {
    const apple = ITEM_BANK.find((item) => item.id === 'eple');
    expect(expectedAnswer('sellBack', 40, [apple])).toBe(40 + apple.price);
  });

  it('keeps a multi-item basket as a sum for both buying and returning', () => {
    const eple = ITEM_BANK.find((item) => item.id === 'eple');
    const melk = ITEM_BANK.find((item) => item.id === 'melk');
    const basket = [eple, melk];
    expect(expectedAnswer('buy', 100, basket)).toBe(eple.price + melk.price);
    expect(expectedAnswer('sellBack', 100, basket)).toBe(eple.price + melk.price);
  });

  it('asks about what is left when buying one thing', () => {
    const eple = ITEM_BANK.find((item) => item.id === 'eple');
    const copy = checkoutCopy('buy', [eple]);
    expect(copy.heading).toBe('Hvor mye har du igjen?');
    expect(copy.hint).toContain(`${eple.price} kr`);
  });

  it('asks about a single return as an addition to what you hold', () => {
    const eple = ITEM_BANK.find((item) => item.id === 'eple');
    const copy = checkoutCopy('sellBack', [eple]);
    expect(copy.heading).toBe('Hvor mye har du etter returen?');
    expect(copy.hint).toContain(`${eple.price} kr`);
  });

  it('asks for the total when buying several things or returning several', () => {
    const eple = ITEM_BANK.find((item) => item.id === 'eple');
    const melk = ITEM_BANK.find((item) => item.id === 'melk');
    expect(checkoutCopy('buy', [eple, melk]).heading).toBe('Hvor mye koster alle varene sammen?');
    expect(checkoutCopy('sellBack', [eple, melk]).heading).toBe('Hvor mye skal butikken betale deg for varene?');
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
