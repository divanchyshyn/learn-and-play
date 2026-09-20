import { describe, it, expect } from 'vitest';
import {
  createDeck, drawFrom, roundOutcome, pickLine, mathLine,
  numberToNorwegian, spokenMath,
  todayKey, loadTally, saveTally, bumpTally,
  HEADLINES, REX_QUIPS, MODES,
} from './Kortkrig.jsx';

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

describe('kortkrig deck', () => {
  it('holds every value from 1 to 20 exactly once', () => {
    for (let trial = 0; trial < 20; trial += 1) {
      const deck = createDeck();
      expect(deck).toHaveLength(20);
      expect([...deck].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
      expect(new Set(deck).size).toBe(20);
    }
  });

  it('deals every card before wrapping around to a fresh deck', () => {
    let deck = createDeck();
    const drawn = [];
    for (let i = 0; i < 20; i += 1) {
      const draw = drawFrom(deck);
      drawn.push(draw.value);
      deck = draw.rest;
      expect(draw.wrapped).toBe(false);
    }
    expect([...drawn].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    // The pile is empty now, so the next draw wraps around with a full new deck.
    // (The wrapped draw's value is unused by the game – the fresh pile matters.)
    const wrapped = drawFrom(deck);
    expect(wrapped.wrapped).toBe(true);
    expect(wrapped.value).toBeNull();
    expect(wrapped.rest).toHaveLength(20);
  });
});

describe('kortkrig round outcome', () => {
  it('gives the round to the bigger card', () => {
    expect(roundOutcome(14, 7)).toBe('player');
    expect(roundOutcome(3, 19)).toBe('opponent');
  });

  it('treats equal cards as a tie that nobody loses', () => {
    expect(roundOutcome(8, 8)).toBe('tie');
    expect(roundOutcome(1, 1)).toBe('tie');
    expect(roundOutcome(20, 20)).toBe('tie');
  });

  it('celebrates every outcome symmetrically – never a sad losing line', () => {
    for (const outcome of ['player', 'opponent', 'tie']) {
      expect(HEADLINES[outcome].length).toBeGreaterThan(0);
      expect(REX_QUIPS[outcome].length).toBeGreaterThan(0);
      for (const line of HEADLINES[outcome]) expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe('kortkrig math lines', () => {
  it('adds the two cards in pluss mode', () => {
    expect(mathLine('pluss', 14, 7)).toBe('14 + 7 = 21');
    expect(mathLine('pluss', 5, 5)).toBe('5 + 5 = 10');
  });

  it('always subtracts the smaller card from the bigger one in minus mode', () => {
    expect(mathLine('minus', 14, 7)).toBe('14 − 7 = 7');
    expect(mathLine('minus', 4, 18)).toBe('18 − 4 = 14');
    expect(mathLine('minus', 9, 9)).toBe('9 − 9 = 0');
  });

  it('shows no arithmetic at all in storst mode', () => {
    expect(mathLine('storst', 12, 3)).toBeNull();
  });

  it('keeps sums and differences inside the 0–100 range of the level', () => {
    for (const a of [1, 2, 10, 11, 19, 20]) {
      for (const b of [1, 2, 10, 11, 19, 20]) {
        const parsed = Number(mathLine('pluss', a, b).split('= ')[1]);
        expect(parsed).toBeGreaterThanOrEqual(0);
        expect(parsed).toBeLessThanOrEqual(100);
        const diff = Number(mathLine('minus', a, b).split('= ')[1]);
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('norwegian number words', () => {
  it('spells out the numbers used by the game', () => {
    expect(numberToNorwegian(0)).toBe('null');
    expect(numberToNorwegian(1)).toBe('en');
    expect(numberToNorwegian(7)).toBe('sju');
    expect(numberToNorwegian(11)).toBe('elleve');
    expect(numberToNorwegian(14)).toBe('fjorten');
    expect(numberToNorwegian(17)).toBe('sytten');
    expect(numberToNorwegian(20)).toBe('tjue');
    expect(numberToNorwegian(21)).toBe('tjueen');
    expect(numberToNorwegian(30)).toBe('tretti');
    expect(numberToNorwegian(48)).toBe('førtiåtte');
    expect(numberToNorwegian(100)).toBe('hundre');
  });

  it('covers the whole 0–100 span without gaps', () => {
    for (let value = 0; value <= 100; value += 1) {
      const word = numberToNorwegian(value);
      expect(word.length).toBeGreaterThan(0);
      expect(word).not.toMatch(/\d/);
    }
  });

  it('speaks whole sentences without digits', () => {
    expect(spokenMath('pluss', 14, 7)).toBe('fjorten pluss sju er tjueen');
    expect(spokenMath('minus', 4, 18)).toBe('atten minus fire er fjorten');
    expect(spokenMath('storst', 12, 3)).toBe('tolv mot tre');
  });
});

describe('reaction picker', () => {
  it('only ever returns lines from the given list', () => {
    const lines = ['en', 'to', 'tre'];
    for (let trial = 0; trial < 50; trial += 1) expect(lines).toContain(pickLine(lines));
    expect(pickLine(['bare'])).toBe('bare');
  });
});

describe('daily tally', () => {
  it('formats dates as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2024, 2, 5))).toBe('2024-03-05');
    expect(todayKey(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('counts up within the same day', () => {
    const monday = new Date(2024, 0, 15, 9, 0, 0);
    const first = bumpTally({ date: '1999-01-01', rounds: 99 }, monday);
    expect(first).toEqual({ date: '2024-01-15', rounds: 1 });
    expect(bumpTally(first, monday)).toEqual({ date: '2024-01-15', rounds: 2 });
  });

  it('starts fresh on a new day instead of stacking old numbers', () => {
    const tuesday = new Date(2024, 0, 16, 8, 30, 0);
    const next = bumpTally({ date: '2024-01-15', rounds: 12 }, tuesday);
    expect(next).toEqual({ date: '2024-01-16', rounds: 1 });
  });

  it('saves and loads through storage, ignoring other days and junk', () => {
    const store = memoryStore();
    expect(loadTally(store)).toBeNull();

    const tally = { date: todayKey(), rounds: 4 };
    saveTally(tally, store);
    expect(loadTally(store)).toEqual(tally);

    store.setItem('kortkrig-tally', '{not json');
    expect(loadTally(store)).toBeNull();

    saveTally({ date: '2000-01-01', rounds: 50 }, store);
    expect(loadTally(store)).toBeNull(); // stale day – not today's business
  });

  it('exposes all three modes with unique ids', () => {
    expect(MODES.map((mode) => mode.id)).toEqual(['pluss', 'minus', 'storst']);
    expect(new Set(MODES.map((mode) => mode.id)).size).toBe(MODES.length);
  });
});
