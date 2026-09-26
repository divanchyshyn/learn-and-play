import {
  CATEGORY_CRATE_IDS, WORD_BANK, crateById, crateTarget, categoryForWord, isWordInBank, wordsInCrate,
} from './words.js';
import { crateTakesWord, readTrip } from './trip.js';

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
  return CATEGORY_CRATE_IDS.reduce((left, crateId) => {
    const { caught, total } = crateTally(journal, crateId);
    return left + Math.max(0, total - caught);
  }, 0);
}

export function allWordsCaught(journal) {
  return wordsLeftToCatch(journal) === 0;
}

// What the celebrate card says when the very last word has been caught.
export const ALL_WORDS_MESSAGE = 'Alle ordene er fanget!';

// How full one crate is: the words of its category in the book, against its
// target of ten – even though the pool behind it holds twenty words. An
// unknown crate has nothing to fill.
export function crateTally(journal, crateId) {
  const caught = journal.words.filter((word) => crateTakesWord(crateId, word)).length;
  const total = crateTarget(crateId);
  return { caught: Math.min(caught, total), total };
}

// The words a crate could still take: its own uncaught words, while the crate
// is not yet full. A crate is done at its target even though its pool holds
// more words, so it takes nothing more – and the rest of its pool never swims
// again either (see unavailableWords).
export function uncaughtWordsInCrate(journal, crateId) {
  if (!crateById(crateId)) return [];
  if (crateFull(journal, crateId)) return [];
  return wordsInCrate(crateId).filter((entry) => !hasWord(journal, entry.word));
}

export function crateFull(journal, crateId) {
  if (!crateById(crateId)) return false;
  const { caught, total } = crateTally(journal, crateId);
  return caught >= total;
}

// The words the sea must not serve any more: the words already in the book,
// plus every word still in the pool of a category that has reached its target.
// Those have no crate left to go to this run, so they never swim again.
export function unavailableWords(journal) {
  const finished = new Set(CATEGORY_CRATE_IDS.filter((crateId) => crateFull(journal, crateId)));
  return new Set(WORD_BANK
    .filter((entry) => finished.has(entry.cat) || hasWord(journal, entry.word))
    .map((entry) => entry.word));
}

// The fishing book lists a crate's caught words in the order they were found.
export function caughtWordsInCrate(journal, crateId) {
  return journal.words.filter((word) => crateTakesWord(crateId, word));
}

// Is there still room in the book for this word? A finished category takes no
// more words, whichever crate on board could sort them.
export function hasRoomForWord(journal, word) {
  const crateId = categoryForWord(word);
  return crateId !== null && !crateFull(journal, crateId);
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
      return readTrip(data.trip);
    } catch {
      return null;
    }
  },
};
