// One trip's rules for Word Fishing: which crates the boat carries, what the
// crew is looking for, and which reef decoration a finished trip unlocks.
// Everything here is pure – the component asks these functions and paints the
// answer, so the whole "what counts as a catch" question is testable on its own.

import {
  CATEGORY_CRATE_IDS,
  LENGTH_CRATE_IDS,
  SHORT_WORD_MAX,
  crateById,
  categoryForWord,
} from './words.js';

// How many good catches end a trip, and how many the boat wants when it is out
// for one particular kind of word.
export const CATCHES_PER_TRIP = 4;
export const ORDER_TRIP_GOAL = 3;

// Trips take turns: the first two let the child sort freely, then a trip asks
// for short/long words, then one asks for a single category. Then it repeats.
// A brand-new player therefore meets one rule at a time.
export const TRIP_CYCLE = ['freeSort', 'freeSort', 'length', 'order'];

export const TRIP_KIND_LABEL = {
  freeSort: 'Sorter fangsten i kassene',
  length: 'Korte ord og lange ord',
  order: 'Bare én kasse i dag',
};

// Which crate holds this word under this trip's rule? A word whose length or
// meaning no crate on board asks for belongs nowhere (`null`) and is gently
// released again.
function lengthCrateIdForWord(word) {
  return word.length <= SHORT_WORD_MAX ? 'short' : 'long';
}

// Does this crate take this word at all, no matter which trip is going on? The
// fishing book uses this to count a word group's progress.
export function crateTakesWord(crateId, word) {
  const crate = crateById(crateId);
  if (!crate) return false;
  if (crate.kind === 'length') return crateId === lengthCrateIdForWord(word);
  return crateId === categoryForWord(word);
}

export function crateAcceptsWord(trip, crateId, word) {
  return trip.crates.includes(crateId) && crateTakesWord(crateId, word);
}

// The one crate this word would go into, or null when no crate on board wants it.
export function crateForWord(trip, word) {
  return trip.crates.find((crateId) => crateAcceptsWord(trip, crateId, word)) ?? null;
}

// Could this word ever be kept on this trip? The shoal uses this to make sure a
// keepable fish keeps showing up while the child is looking for one.
export function acceptsWord(trip, word) {
  return crateForWord(trip, word) !== null;
}

export function tripKindForNumber(tripNumber) {
  const index = (Math.max(1, tripNumber) - 1) % TRIP_CYCLE.length;
  return TRIP_CYCLE[index];
}

// A fresh trip. `tripNumber` is the number of finished trips + 1, and only the
// kind's randomness (which category the boat is after) needs a random source.
export function createTripPlan(tripNumber, random = Math.random) {
  const number = Math.max(1, Math.trunc(tripNumber) || 1);
  const kind = tripKindForNumber(number);
  if (kind === 'length') {
    return { number, kind, crates: [...LENGTH_CRATE_IDS], goal: CATCHES_PER_TRIP, collected: 0, orderCrateId: null };
  }
  if (kind === 'order') {
    const orderCrateId = CATEGORY_CRATE_IDS[Math.floor(random() * CATEGORY_CRATE_IDS.length)];
    return { number, kind, crates: [orderCrateId], goal: ORDER_TRIP_GOAL, collected: 0, orderCrateId };
  }
  return { number, kind, crates: [...CATEGORY_CRATE_IDS], goal: CATCHES_PER_TRIP, collected: 0, orderCrateId: null };
}

export function tripComplete(trip) {
  return trip.collected >= trip.goal;
}

export function withDelivery(trip) {
  return { ...trip, collected: Math.min(trip.goal, trip.collected + 1) };
}

export function tripProgress(trip) {
  return `${trip.collected} av ${trip.goal}`;
}

// The order card the boat carries: what the crew is looking for right now.
export function tripRequest(trip) {
  if (trip.kind === 'order') {
    const crate = crateById(trip.orderCrateId);
    return `I dag trenger vi ${trip.goal} ${crate.label.toLowerCase()}`;
  }
  if (trip.kind === 'length') return `I dag sorterer vi ${SHORT_WORD_MAX} bokstaver eller mindre mot lengre ord`;
  return 'Sorter hver fisk i kassen den hører til';
}

// ---- The reef -------------------------------------------------------------
// Every finished trip decorates the seabed a little more, in this fixed order.
// Positions are percentages of the sea box, so the scene and the tests agree on
// where each reward lands. Only indices are ever stored (see journal.js), and an
// index past the end of this list is simply skipped when painting – so this list
// may grow or shrink without breaking a saved game.

export const REEF_REWARDS = [
  { id: 'starfish', label: 'Sjøstjernen', x: 8, y: 93, size: 30 },
  { id: 'coral', label: 'Korallen', x: 23, y: 88, size: 52 },
  { id: 'shell', label: 'Skjellet', x: 57, y: 96, size: 24 },
  { id: 'seagrass', label: 'Sjøgresset', x: 39, y: 86, size: 58 },
  { id: 'crab', label: 'Krabben', x: 71, y: 94, size: 32 },
  { id: 'jellyfish', label: 'Maneten', x: 87, y: 68, size: 40 },
  { id: 'octopus', label: 'Blekkspruten', x: 5, y: 80, size: 46 },
  { id: 'seahorse', label: 'Sjøhesten', x: 94, y: 81, size: 36 },
  { id: 'wreck', label: 'Skipsvraket', x: 64, y: 83, size: 104 },
  { id: 'chest', label: 'Skattekisten', x: 31, y: 95, size: 42 },
];

export function rewardForTrip(tripNumber) {
  const index = Math.max(1, tripNumber) - 1;
  return REEF_REWARDS[index] ?? null;
}

// Asked for by the scene: the decorations a saved journal has earned, paired
// with their artwork description. An index past the end of the list (a save
// from a version with more decorations) is simply skipped.
export function unlockedRewards(decorationIndexes) {
  return decorationIndexes
    .map((index) => REEF_REWARDS[index])
    .filter(Boolean);
}

// ---- Reading a saved trip back -------------------------------------------
// A stored trip is only trusted when it is a shape this version of the game
// could actually have dealt: the right kind for its number, exactly the crates
// and the goal that kind is dealt with, and a progress that has not run past
// its own goal. Anything else falls back to a fresh trip instead of a boat with
// no crates.
//
// The crates each kind is dealt with, and the one goal it is dealt with. A
// length trip with two category crates, an order trip pointing at a length
// crate, or an order goal on a free-sorting trip is a shape this game never
// handed out, so it is refused rather than half-understood.
function dealtCrates(kind, orderCrateId) {
  if (kind === 'length') return orderCrateId === null ? [...LENGTH_CRATE_IDS] : null;
  if (kind === 'order') {
    const crate = crateById(orderCrateId);
    return crate && crate.kind === 'category' ? [orderCrateId] : null;
  }
  return orderCrateId === null ? [...CATEGORY_CRATE_IDS] : null;
}

function dealtGoal(kind) {
  return kind === 'order' ? ORDER_TRIP_GOAL : CATCHES_PER_TRIP;
}

export function isValidTripShape(saved) {
  if (!saved || typeof saved !== 'object') return false;
  if (typeof saved.kind !== 'string' || !(saved.kind in TRIP_KIND_LABEL)) return false;
  if (!Number.isInteger(saved.number) || saved.number < 1) return false;
  if (tripKindForNumber(saved.number) !== saved.kind) return false;
  if (!Array.isArray(saved.crates) || saved.crates.length === 0) return false;
  if (saved.crates.some((crateId) => !crateById(crateId))) return false;
  if (new Set(saved.crates).size !== saved.crates.length) return false;
  if (!Number.isInteger(saved.goal) || !Number.isInteger(saved.collected)) return false;
  if (saved.collected < 0 || saved.collected > saved.goal) return false;
  if (saved.goal !== dealtGoal(saved.kind)) return false;
  const dealt = dealtCrates(saved.kind, saved.orderCrateId);
  if (!dealt || saved.crates.length !== dealt.length) return false;
  return saved.crates.every((crateId) => dealt.includes(crateId));
}

