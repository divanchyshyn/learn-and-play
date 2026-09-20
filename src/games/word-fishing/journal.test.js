import { describe, it, expect } from 'vitest';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, allWordsCaught, createJournal, crateTally,
  hasWord, journalCodec, recordCatch, recordDecoration, recordTrip, tripCodec,
  wordsCaught, wordsLeftToCatch,
} from './journal.js';
import { createTripPlan, REEF_REWARDS } from './trip.js';
import { CATEGORY_CRATE_IDS, LENGTH_CRATE_IDS, SHORT_WORD_MAX, WORD_BANK, WORD_COUNT } from './words.js';

describe('word-fishing journal', () => {
  it('starts empty', () => {
    const journal = createJournal();
    expect(journal).toEqual({ words: [], trips: 0, decorations: [] });
    expect(wordsCaught(journal)).toBe(0);
    expect(wordsLeftToCatch(journal)).toBe(WORD_COUNT);
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

  it('knows when the whole bank has been caught', () => {
    let journal = createJournal();
    for (const entry of WORD_BANK) journal = recordCatch(journal, entry.word);
    expect(wordsCaught(journal)).toBe(WORD_COUNT);
    expect(wordsLeftToCatch(journal)).toBe(0);
    expect(allWordsCaught(journal)).toBe(true);
    expect(ALL_WORDS_MESSAGE).toBe('Alle ordene er fanget!');
  });

  it('counts a crate of words two ways', () => {
    const journal = { words: ['fisk', 'katt', 'ost'], trips: 0, decorations: [] };
    const animals = crateTally(journal, CATEGORY_CRATE_IDS[0]);
    expect(animals.caught).toBe(2);
    expect(animals.total).toBe(WORD_COUNT / CATEGORY_CRATE_IDS.length);

    // The length crates count the very same words, just by how long they are.
    const shortWords = WORD_BANK.filter((entry) => entry.word.length <= SHORT_WORD_MAX);
    expect(crateTally(journal, LENGTH_CRATE_IDS[0]).total).toBe(shortWords.length);
    expect(crateTally(journal, LENGTH_CRATE_IDS[1]).total).toBe(WORD_COUNT - shortWords.length);
    expect(crateTally(createJournal(), LENGTH_CRATE_IDS[0]).caught).toBe(0);
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
    for (const number of [1, 3, 4]) {
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

  it('never restores more progress than the goal', () => {
    const trip = { ...createTripPlan(1), collected: 99 };
    expect(tripCodec.parse(tripCodec.serialize(trip)).collected).toBe(trip.goal);
  });
});
