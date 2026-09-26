import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CREATURES, CREATURES_PER_PAGE, PAGE_COUNT, PAGES, TIERS,
  attempt, creatureById, creaturesInPage, equationText, makeRiddle,
  numberToNorwegian, pageById, riddleLabel, spokenEquation, tierForDiscovered,
} from './riddles.js';
import {
  ALBUM_KEY, albumCodec, albumComplete, createAlbum, discoverCreature,
  foundCount, nextCreature, pageTally,
} from './album.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// A small deterministic generator so the riddle invariants can be checked over
// hundreds of deals without ever depending on luck.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('card-battle creature roster', () => {
  it('holds exactly four animals on each of the four pages', () => {
    expect(CREATURES).toHaveLength(PAGE_COUNT * CREATURES_PER_PAGE);
    for (const page of PAGES) expect(creaturesInPage(page.id)).toHaveLength(CREATURES_PER_PAGE);
  });

  it('gives every animal a unique English id, a Norwegian name and a fact', () => {
    const ids = CREATURES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(CREATURES.length);
    for (const entry of CREATURES) {
      expect(entry.id).toMatch(/^[a-z]+$/);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.fact.length).toBeGreaterThan(0);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(pageById(entry.page)).not.toBeNull();
      expect(creatureById(entry.id)).toBe(entry);
    }
    expect(creatureById('dragon')).toBeNull();
  });
});

describe('card-battle difficulty tiers', () => {
  it('moves through the four tiers one album page at a time', () => {
    const expected = ['plus10', 'plus18', 'minus', 'mixed'];
    for (let count = 0; count < CREATURES.length; count += 1) {
      expect(tierForDiscovered(count)).toBe(expected[Math.floor(count / CREATURES_PER_PAGE)]);
    }
    expect(tierForDiscovered(CREATURES.length)).toBe('mixed');
    expect(tierForDiscovered(99)).toBe('mixed');
    expect(tierForDiscovered(-1)).toBe('plus10');
    expect(tierForDiscovered(undefined)).toBe('plus10');
  });
});

describe('card-battle riddle generation', () => {
  it('always deals four different cards, one of which solves the riddle', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(20260926));
    for (let trial = 0; trial < 400; trial += 1) {
      const tier = TIERS[trial % TIERS.length];
      const riddle = makeRiddle(tier);

      expect(riddle.hand).toHaveLength(4);
      expect(new Set(riddle.hand).size).toBe(4);
      expect(riddle.hand).toContain(riddle.answer);
      for (const card of riddle.hand) {
        expect(card).toBeGreaterThanOrEqual(1);
        expect(card).toBeLessThanOrEqual(10);
        // A card is never shown producing a negative number.
        expect(attempt(riddle, card).result).toBeGreaterThan(0);
      }

      // Exactly one card fits – a child who checks their work always lands on
      // the same answer.
      expect(riddle.hand.filter((card) => attempt(riddle, card).correct)).toEqual([riddle.answer]);
      expect(attempt(riddle, riddle.answer)).toEqual({ correct: true, result: riddle.target });

      if (riddle.operation === 'plus') {
        expect(riddle.answer + riddle.rexValue).toBe(riddle.target);
        expect(riddle.rexValue).toBeGreaterThanOrEqual(1);
        expect(riddle.rexValue).toBeLessThanOrEqual(9);
        if (tier === 'plus10') {
          expect(riddle.target).toBeGreaterThanOrEqual(2);
          expect(riddle.target).toBeLessThanOrEqual(10);
        } else if (tier === 'plus18') {
          expect(riddle.target).toBeGreaterThanOrEqual(11);
          expect(riddle.target).toBeLessThanOrEqual(18);
        } else {
          expect(riddle.target).toBeGreaterThanOrEqual(2);
          expect(riddle.target).toBeLessThanOrEqual(18);
        }
      } else {
        expect(riddle.answer - riddle.rexValue).toBe(riddle.target);
        expect(riddle.rexValue).toBeGreaterThanOrEqual(1);
        expect(riddle.rexValue).toBeLessThanOrEqual(4);
        expect(riddle.target).toBeGreaterThanOrEqual(1);
        expect(riddle.target).toBeLessThanOrEqual(9);
        // Every hand card can be tried without borrowing: all are bigger than
        // Rex's card.
        for (const card of riddle.hand) expect(card).toBeGreaterThan(riddle.rexValue);
      }
    }
  });

  it('deals both operations in mixed tier instead of settling into a rut', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(7));
    const operations = new Set();
    for (let trial = 0; trial < 100; trial += 1) operations.add(makeRiddle('mixed').operation);
    expect(operations).toEqual(new Set(['plus', 'minus']));
  });

  it('falls back to the easiest tier for an unknown tier id', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(3));
    for (let trial = 0; trial < 20; trial += 1) {
      const riddle = makeRiddle('gardening');
      expect(riddle.operation).toBe('plus');
      expect(riddle.target).toBeLessThanOrEqual(10);
    }
  });
});

describe('card-battle attempts', () => {
  it('checks a card against the riddle and reports the real result', () => {
    const plus = { operation: 'plus', rexValue: 9, target: 15, answer: 6 };
    expect(attempt(plus, 6)).toEqual({ correct: true, result: 15 });
    expect(attempt(plus, 4)).toEqual({ correct: false, result: 13 });

    const minus = { operation: 'minus', rexValue: 4, target: 2, answer: 6 };
    expect(attempt(minus, 6)).toEqual({ correct: true, result: 2 });
    expect(attempt(minus, 5)).toEqual({ correct: false, result: 1 });
  });

  it('writes equations the way the child reads them', () => {
    expect(equationText('plus', 4, 9, 13)).toBe('4 + 9 = 13');
    expect(equationText('minus', 6, 4, 2)).toBe('6 − 4 = 2');
  });

  it('reads the riddle and the solved equation aloud in Norwegian', () => {
    expect(riddleLabel({ operation: 'plus', rexValue: 9, target: 15 })).toBe('ni pluss noe er femten');
    expect(riddleLabel({ operation: 'minus', rexValue: 4, target: 2 })).toBe('noe minus fire er to');
    expect(spokenEquation('plus', 6, 9)).toBe('seks pluss ni er femten');
    expect(spokenEquation('minus', 6, 4)).toBe('seks minus fire er to');
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

  it('covers the whole 0–100 span without digits', () => {
    for (let value = 0; value <= 100; value += 1) {
      const word = numberToNorwegian(value);
      expect(word.length).toBeGreaterThan(0);
      expect(word).not.toMatch(/\d/);
    }
  });
});

describe('card-battle album', () => {
  it('starts empty and offers the first animal in roster order', () => {
    const album = createAlbum();
    expect(foundCount(album)).toBe(0);
    expect(albumComplete(album)).toBe(false);
    expect(nextCreature(album)).toBe(CREATURES[0]);
  });

  it('records one animal once and ignores unknown ids', () => {
    const album = createAlbum();
    const withFox = discoverCreature(album, 'fox');
    expect(withFox).toEqual({ discovered: ['fox'] });
    expect(withFox).not.toBe(album);
    // A repeat or an unknown card changes nothing, not even the reference.
    expect(discoverCreature(withFox, 'fox')).toBe(withFox);
    expect(discoverCreature(withFox, 'dragon')).toBe(withFox);
    expect(discoverCreature(withFox, 42)).toBe(withFox);
  });

  it('fills the next missing animal even after an out-of-order save', () => {
    const album = { discovered: ['wolf', 'fox'] };
    expect(nextCreature(album)).toBe(creatureById('owl'));
  });

  it('knows when the album is complete', () => {
    const album = CREATURES.reduce((current, entry) => discoverCreature(current, entry.id), createAlbum());
    expect(foundCount(album)).toBe(CREATURES.length);
    expect(albumComplete(album)).toBe(true);
    expect(nextCreature(album)).toBeNull();
  });

  it('counts a page against the animals the roster puts on it', () => {
    const album = { discovered: ['fox', 'owl', 'lion'] };
    expect(pageTally(album, 'forest')).toEqual({ found: 2, total: CREATURES_PER_PAGE });
    expect(pageTally(album, 'mountain')).toEqual({ found: 0, total: CREATURES_PER_PAGE });
    expect(pageTally(album, 'savanna')).toEqual({ found: 1, total: CREATURES_PER_PAGE });
    expect(pageTally(album, 'nowhere')).toEqual({ found: 0, total: 0 });
  });

  it('saves and loads through its own English storage key', () => {
    expect(ALBUM_KEY).toBe('cardBattle:album');
    const store = createAlbum();
    const album = discoverCreature(discoverCreature(store, 'otter'), 'fox');
    expect(albumCodec.parse(albumCodec.serialize(album))).toEqual(album);
  });

  it('refuses junk and stale versions and cleans duplicate or foreign cards', () => {
    expect(albumCodec.parse('{not json')).toBeNull();
    expect(albumCodec.parse('null')).toBeNull();
    expect(albumCodec.parse(JSON.stringify({ version: 0, album: { discovered: ['fox'] } }))).toBeNull();
    expect(albumCodec.parse(JSON.stringify({ version: 1, album: null }))).toBeNull();
    expect(albumCodec.parse(JSON.stringify({
      version: 1,
      album: { discovered: ['fox', 'fox', 'dragon', 7, 'owl'] },
    }))).toEqual({ discovered: ['fox', 'owl'] });
    expect(albumCodec.parse(JSON.stringify({ version: 1, album: { discovered: 'fox' } })))
      .toEqual({ discovered: [] });
  });
});
