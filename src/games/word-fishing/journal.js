import { isWordInBank, WORD_BANK, WORD_COUNT } from './words.js';
import { crateTakesWord, isValidTripShape } from './trip.js';

// The fishing journal is what makes Word Fishing a game a child can come back
// to: which words have been caught, how many trips are finished, and which reef
// decorations those trips unlocked. It lives in its own saved value, and it is
// keyed by the word itself rather than by a position in the bank – so the word
// bank may grow (or lose an entry) without ever losing a saved catch.
//
// A second saved value holds the trip that is going on right now, so a reload
// drops the child back onto the same boat with the same crates and the same
// count. The shoal itself is not saved: those five fish are ambience, and a
// fresh shoal on the next visit is not lost progress.

export const JOURNAL_KEY = 'wordFishing:journal';
export const TRIP_KEY = 'wordFishing:trip';
const JOURNAL_VERSION = 1;
const TRIP_VERSION = 1;

export function createJournal() {
  return { words: [], trips: 0, decorations: [] };
}

export function hasWord(journal, word) {
  return journal.words.includes(word);
}

// Record one caught word. Returns the very same journal when there is nothing
// new to remember (the word was caught before, or the bank no longer has it), so
// a repeat catch never writes storage for nothing.
export function recordCatch(journal, word) {
  if (!isWordInBank(word) || journal.words.includes(word)) return journal;
  return { ...journal, words: [...journal.words, word] };
}

export function recordTrip(journal) {
  return { ...journal, trips: journal.trips + 1 };
}

// A decoration index is accepted as any whole number `>= 0`; painting skips the
// ones this version does not have (see unlockedRewards), so the reef may grow
// later without breaking a saved game.
function isDecorationIndex(index) {
  return Number.isInteger(index) && index >= 0;
}

export function recordDecoration(journal, decorationIndex) {
  if (!isDecorationIndex(decorationIndex) || journal.decorations.includes(decorationIndex)) return journal;
  return { ...journal, decorations: [...journal.decorations, decorationIndex] };
}

export function wordsCaught(journal) {
  return journal.words.length;
}

export function wordsLeftToCatch(journal) {
  return Math.max(0, WORD_COUNT - journal.words.length);
}

export function allWordsCaught(journal) {
  return wordsLeftToCatch(journal) === 0;
}

// What the celebrate card says when the very last word has been caught.
export const ALL_WORDS_MESSAGE = 'Alle ordene er fanget!';

// How full one crate is: how many of its words are in the book, out of the words
// that ever go in it.
export function crateTally(journal, crateId) {
  return {
    caught: journal.words.filter((word) => crateTakesWord(crateId, word)).length,
    total: WORD_BANK.filter((entry) => crateTakesWord(crateId, entry.word)).length,
  };
}

function normalizeWords(words) {
  if (!Array.isArray(words)) return [];
  return [...new Set(words.filter((word) => typeof word === 'string' && isWordInBank(word)))];
}

function normalizeDecorations(decorations) {
  if (!Array.isArray(decorations)) return [];
  return [...new Set(decorations.filter(isDecorationIndex))];
}

export const journalCodec = {
  serialize(journal) {
    return JSON.stringify({ version: JOURNAL_VERSION, journal });
  },
  parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== JOURNAL_VERSION) return null;
      const saved = data.journal;
      if (!saved || typeof saved !== 'object') return null;
      return {
        words: normalizeWords(saved.words),
        trips: Number.isInteger(saved.trips) && saved.trips >= 0 ? saved.trips : 0,
        decorations: normalizeDecorations(saved.decorations),
      };
    } catch {
      return null;
    }
  },
};

export const tripCodec = {
  serialize(trip) {
    return JSON.stringify({ version: TRIP_VERSION, trip });
  },
  parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== TRIP_VERSION) return null;
      const saved = data.trip;
      if (!isValidTripShape(saved)) return null;
      return {
        number: saved.number,
        kind: saved.kind,
        crates: [...saved.crates],
        goal: saved.goal,
        collected: Math.min(saved.goal, saved.collected),
        orderCrateId: saved.kind === 'order' ? saved.orderCrateId : null,
      };
    } catch {
      return null;
    }
  },
};
