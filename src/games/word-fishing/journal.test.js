import { describe, it, expect } from 'vitest';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, allWordsCaught, caughtWordsInCrate, createJournal,
  crateFull, crateTally, hasRoomForWord, hasWord, journalCodec, openCategoryIds, recordCatch,
  recordDecoration, recordTrip, tripCodec, tripHasWork, unavailableWords, uncaughtWordsInCrate,
  wordsCaught, wordsLeftToCatch,
} from './journal.js';
import { createTripPlan, REEF_REWARDS } from './trip.js';
import {
  CATEGORY_CRATE_IDS, CRATE_TARGET, TARGET_WORD_COUNT, WORD_BANK, WORD_COUNT, crateWordCount,
  wordsInCrate,
} from './words.js';

describe('word-fishing journal', () => {
  it('starts empty', () => {
    const journal = createJournal();
    expect(journal).toEqual({ words: [], trips: 0, decorations: [] });
    expect(wordsCaught(journal)).toBe(0);
    expect(wordsLeftToCatch(journal)).toBe(TARGET_WORD_COUNT);
    expect(allWordsCaught(journal)).toBe(false);
    expect(hasWord(journal, 'fisk')).toBe(false);
  });

  it('remembers a caught word exactly once', () => {
    const first = recordCatch(createJournal(), 'fisk');
    expect(first.words).toEqual(['fisk']);
    expect(hasWord(first, 'fisk')).toBe(true);
    expect(wordsCaught(first)).toBe(1);
    // Catching the same word again changes nothing at all – not even a new object.
    expect(recordCatch(first, 'fisk')).toBe(first);
  });

  it('ignores words the bank no longer has', () => {
    const journal = createJournal();
    expect(recordCatch(journal, 'finnesikke')).toBe(journal);
  });

  it('knows when every crate has reached its target', () => {
    let journal = createJournal();
    for (const crateId of CATEGORY_CRATE_IDS) {
      for (const entry of wordsInCrate(crateId).slice(0, CRATE_TARGET)) {
        journal = recordCatch(journal, entry.word);
      }
    }
    expect(wordsCaught(journal)).toBe(TARGET_WORD_COUNT);
    expect(wordsLeftToCatch(journal)).toBe(0);
    expect(allWordsCaught(journal)).toBe(true);
    expect(ALL_WORDS_MESSAGE).toBe('Alle ordene er fanget!');

    // One word short somewhere keeps the book open, even though every pool
    // still holds words that were never caught.
    const short = { ...journal, words: journal.words.slice(1) };
    expect(wordsLeftToCatch(short)).toBe(1);
    expect(allWordsCaught(short)).toBe(false);
    expect(WORD_COUNT).toBeGreaterThan(TARGET_WORD_COUNT);
  });

  it('counts a crate of words against its target, not its pool', () => {
    const journal = { words: ['fisk', 'katt', 'ost'], trips: 0, decorations: [] };
    const animals = crateTally(journal, CATEGORY_CRATE_IDS[0]);
    expect(animals.caught).toBe(2);
    expect(animals.total).toBe(CRATE_TARGET);
    // The pool behind the target is twice as big as the goal.
    expect(crateWordCount(CATEGORY_CRATE_IDS[0])).toBeGreaterThan(CRATE_TARGET);

    // A crate the boat does not carry has nothing in it and no target.
    expect(crateTally(journal, 'finnesikke')).toEqual({ caught: 0, total: 0 });
  });

  it('knows which words a crate could still take', () => {
    const journal = { words: ['fisk', 'katt'], trips: 0, decorations: [] };
    const left = uncaughtWordsInCrate(journal, CATEGORY_CRATE_IDS[0]);
    expect(left).toHaveLength(crateWordCount(CATEGORY_CRATE_IDS[0]) - 2);
    expect(left.some((entry) => entry.word === 'fisk')).toBe(false);
    expect(crateFull(journal, CATEGORY_CRATE_IDS[0])).toBe(false);
  });

  it('calls a crate full once its target is reached, not when its pool runs out', () => {
    const pool = wordsInCrate('nature').map((entry) => entry.word);
    const almost = { words: pool.slice(0, CRATE_TARGET - 1), trips: 0, decorations: [] };
    expect(crateFull(almost, 'nature')).toBe(false);

    const full = { ...almost, words: pool.slice(0, CRATE_TARGET) };
    expect(crateFull(full, 'nature')).toBe(true);
    // Half the pool is still uncaught, yet the crate can take no more.
    expect(uncaughtWordsInCrate(full, 'nature')).toEqual([]);
    expect(pool.length).toBeGreaterThan(CRATE_TARGET);
  });

  it('knows a trip that can no longer add a word to the book', () => {
    const nature = wordsInCrate('nature').slice(0, CRATE_TARGET).map((entry) => entry.word);
    const full = { words: nature, trips: 0, decorations: [] };
    const orderTrip = createTripPlan(4, () => 0.5);
    expect(orderTrip.orderCrateId).toBe('nature');
    expect(tripHasWork(orderTrip, full)).toBe(false);
    expect(tripHasWork(orderTrip, { ...full, words: nature.slice(0, -1) })).toBe(true);
    // A free-sorting trip carries every crate, so with only Nature finished it
    // still has work in the other categories.
    expect(tripHasWork(createTripPlan(1), full)).toBe(true);
    expect(tripHasWork(createTripPlan(2), full)).toBe(true);
    // Only a fully caught book stops every trip.
    expect(tripHasWork(createTripPlan(1), { words: WORD_BANK.map((entry) => entry.word), trips: 0, decorations: [] })).toBe(false);
  });

  it('lists the categories that still have words to find', () => {
    const nature = wordsInCrate('nature').slice(0, CRATE_TARGET).map((entry) => entry.word);
    const journal = { words: nature, trips: 0, decorations: [] };
    expect(openCategoryIds(journal)).toEqual(CATEGORY_CRATE_IDS.filter((id) => id !== 'nature'));
    expect(openCategoryIds(createJournal())).toEqual(CATEGORY_CRATE_IDS);
  });

  it('keeps every word of a finished crate out of the water', () => {
    const naturePool = wordsInCrate('nature').map((entry) => entry.word);
    const journal = { words: naturePool.slice(0, CRATE_TARGET), trips: 0, decorations: [] };
    const unavailable = unavailableWords(journal);
    // The caught words and the whole rest of the finished pool stay out.
    for (const word of naturePool) expect(unavailable.has(word)).toBe(true);
    // A word from a crate that is still open may still swim.
    const openWord = wordsInCrate('animals').find((entry) => !hasWord(journal, entry.word)).word;
    expect(unavailable.has(openWord)).toBe(false);
  });

  it('lists a crate\'s caught words in the order they were found', () => {
    let journal = recordCatch(createJournal(), 'ost');
    journal = recordCatch(journal, 'fisk');
    expect(caughtWordsInCrate(journal, 'food')).toEqual(['ost']);
    expect(caughtWordsInCrate(journal, 'animals')).toEqual(['fisk']);
    expect(unavailableWords(journal).has('ost')).toBe(true);
  });

  it('has room for a word while its category is open', () => {
    const journal = {
      words: wordsInCrate('nature').slice(0, CRATE_TARGET).map((entry) => entry.word),
      trips: 0,
      decorations: [],
    };
    expect(hasRoomForWord(journal, wordsInCrate('nature')[0].word)).toBe(false);
    expect(hasRoomForWord(journal, wordsInCrate('animals')[0].word)).toBe(true);
    expect(hasRoomForWord(journal, 'finnesikke')).toBe(false);
  });

  it('stamps trips and decorations without ever counting one twice', () => {
    let journal = recordTrip(createJournal());
    expect(journal.trips).toBe(1);
    journal = recordTrip(journal);
    expect(journal.trips).toBe(2);

    journal = recordDecoration(journal, 0);
    expect(journal.decorations).toEqual([0]);
    expect(recordDecoration(journal, 0)).toBe(journal);
    expect(recordDecoration(journal, -1)).toBe(journal);
    expect(recordDecoration(journal, 1.5)).toBe(journal);
    const twice = recordDecoration(journal, 1);
    expect(twice.decorations).toEqual([0, 1]);
  });
});

describe('word-fishing journal storage', () => {
  it('round-trips a whole journal', () => {
    const journal = { words: ['fisk', 'is'], trips: 3, decorations: [0, 1, 2] };
    expect(journalCodec.parse(journalCodec.serialize(journal))).toEqual(journal);
    expect(JOURNAL_KEY).toBe('wordFishing:journal');
  });

  it('refuses a save from another version or another shape', () => {
    expect(journalCodec.parse('{"version":99,"journal":{"words":[]}}')).toBeNull();
    expect(journalCodec.parse('{"version":1}')).toBeNull();
    expect(journalCodec.parse('{"version":1,"journal":"mange ord"}')).toBeNull();
    expect(journalCodec.parse('ikke json i det hele tatt')).toBeNull();
  });

  it('drops words the bank no longer has and collapses repeats', () => {
    const raw = JSON.stringify({
      version: 1,
      journal: { words: ['fisk', 'fisk', 'finnesikke', 7, 'is'], trips: -2, decorations: [0, 0, -1, 'x', 3] },
    });
    expect(journalCodec.parse(raw)).toEqual({ words: ['fisk', 'is'], trips: 0, decorations: [0, 3] });
  });

  it('keeps any whole decoration index, so a bigger reef still reads', () => {
    const raw = JSON.stringify({ version: 1, journal: { words: [], trips: 0, decorations: [REEF_REWARDS.length + 4] } });
    expect(journalCodec.parse(raw).decorations).toEqual([REEF_REWARDS.length + 4]);
  });
});

describe('word-fishing trip storage', () => {
  it('round-trips every trip kind', () => {
    expect(TRIP_KEY).toBe('wordFishing:trip');
    for (const number of [1, 2, 4]) {
      const trip = createTripPlan(number);
      expect(tripCodec.parse(tripCodec.serialize(trip))).toEqual(trip);
    }
  });

  it('refuses a trip this version would not have dealt', () => {
    const trip = createTripPlan(1);
    expect(tripCodec.parse('{"version":2,"trip":' + JSON.stringify(trip) + '}')).toBeNull();
    expect(tripCodec.parse(JSON.stringify({ version: 1, trip: { ...trip, kind: 'slappe-av' } }))).toBeNull();
    expect(tripCodec.parse('{}')).toBeNull();
    expect(tripCodec.parse('ikke json')).toBeNull();
  });

  it('refuses progress that runs past the goal', () => {
    // A delivery is always clamped to the goal (see withDelivery), so a trip
    // saved past its own goal is a shape this game could not have written: the
    // whole trip falls back to a fresh one instead of being half-trusted.
    const trip = { ...createTripPlan(1), collected: 99 };
    expect(tripCodec.parse(tripCodec.serialize(trip))).toBeNull();
    expect(tripCodec.parse(tripCodec.serialize({ ...createTripPlan(1), collected: 3 })).collected).toBe(3);
  });
});
