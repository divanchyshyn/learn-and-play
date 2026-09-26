// One trip's rules for Word Fishing: which crates the boat carries, what the
// crew is looking for, and which reef decoration a finished trip unlocks.
// Everything here is pure – the component asks these functions and paints the
// answer, so the whole "what counts as a catch" question is testable on its own.

import {
  CATEGORY_CRATE_IDS,
  crateById,
  categoryForWord,
} from './words.js';

// How many good catches end a trip.
export const CATCHES_PER_TRIP = 4;

// Every trip is the same free-sorting trip: the boat carries all four crates,
// and the child decides which one each catch belongs in. The one-crate order
// trips an earlier version dealt in a cycle are gone – sorting freely is the
// only kind of fishing there is. A saved order trip is still read back as the
// free-sorting trip that replaced it (see `readTrip` below).

// Does this crate take this word? A word whose meaning no crate on board asks
// for belongs nowhere (`null`) and is gently released again. The fishing book
// counts a crate's progress by this very same rule.
export function crateTakesWord(crateId, word) {
  return crateById(crateId) !== null && crateId === categoryForWord(word);
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

// A fresh trip. `tripNumber` is the number of finished trips + 1.
export function createTripPlan(tripNumber) {
  const number = Math.max(1, Math.trunc(tripNumber) || 1);
  return {
    number,
    kind: 'freeSort',
    crates: [...CATEGORY_CRATE_IDS],
    goal: CATCHES_PER_TRIP,
    collected: 0,
    orderCrateId: null,
  };
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

// The card the boat carries: sorting every catch by meaning is the whole task,
// so every trip asks for the same thing.
export function tripRequest() {
  return 'Sorter hver fisk i kassen den hører til';
}

// ---- The reef -------------------------------------------------------------
// Every finished trip decorates the seabed a little more, in this fixed order.
// Positions are percentages of the sea box, so the scene and the tests agree on
// where each reward lands. Only indices are ever stored (see journal.js), and an
// index past the end of this list is simply skipped when painting – so this list
// may grow or shrink without breaking a saved game.

// Sizes are generous on purpose: the seabed is the child's own collection, and
// a small decoration is easy to miss. Each one also carries a little motion
// (see the `.reward-*` rules in style.css), so the floor feels alive.
export const REEF_REWARDS = [
  { id: 'starfish', label: 'Sjøstjernen', x: 8, y: 91, size: 44 },
  { id: 'coral', label: 'Korallen', x: 23, y: 87, size: 72 },
  { id: 'shell', label: 'Skjellet', x: 57, y: 93, size: 34 },
  { id: 'seagrass', label: 'Sjøgresset', x: 39, y: 85, size: 78 },
  { id: 'crab', label: 'Krabben', x: 71, y: 92, size: 46 },
  { id: 'jellyfish', label: 'Maneten', x: 87, y: 66, size: 56 },
  { id: 'octopus', label: 'Blekkspruten', x: 5, y: 79, size: 64 },
  { id: 'seahorse', label: 'Sjøhesten', x: 94, y: 80, size: 52 },
  { id: 'wreck', label: 'Skipsvraket', x: 64, y: 80, size: 128 },
  { id: 'chest', label: 'Skattekisten', x: 31, y: 92, size: 58 },
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
// could actually have dealt: a free-sorting trip carrying all four crates, with
// the goal that kind is dealt with and a progress that has not run past its own
// goal. Anything else falls back to a fresh trip instead of a boat with no
// crates.
//
// The one-crate order trips an earlier version dealt are not a shape this
// version hands out any more, but a save that holds one is still read back – as
// the free-sorting trip that replaced it, keeping the trip number and the
// catches made so far, so a child never sees the boat's number jump.

function freeSortTripFrom(saved) {
  return {
    number: saved.number,
    kind: 'freeSort',
    crates: [...CATEGORY_CRATE_IDS],
    goal: CATCHES_PER_TRIP,
    collected: Math.min(saved.collected, CATCHES_PER_TRIP),
    orderCrateId: null,
  };
}

export function isValidTripShape(saved) {
  if (!saved || typeof saved !== 'object') return false;
  if (saved.kind !== 'freeSort') return false;
  if (!Number.isInteger(saved.number) || saved.number < 1) return false;
  if (!Array.isArray(saved.crates) || saved.crates.length !== CATEGORY_CRATE_IDS.length) return false;
  if (saved.crates.some((crateId) => !crateById(crateId))) return false;
  if (new Set(saved.crates).size !== saved.crates.length) return false;
  if (!CATEGORY_CRATE_IDS.every((crateId) => saved.crates.includes(crateId))) return false;
  if (saved.orderCrateId !== null) return false;
  if (!Number.isInteger(saved.goal) || saved.goal !== CATCHES_PER_TRIP) return false;
  if (!Number.isInteger(saved.collected) || saved.collected < 0 || saved.collected > saved.goal) return false;
  return true;
}

// An order trip the older cycle dealt: exactly one known crate, its own goal,
// and progress that never ran past it. Null for anything else.
function migratedOrderTrip(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (saved.kind !== 'order') return null;
  if (!Number.isInteger(saved.number) || saved.number < 1) return null;
  if (!crateById(saved.orderCrateId)) return null;
  if (!Array.isArray(saved.crates) || saved.crates.length !== 1) return null;
  if (saved.crates[0] !== saved.orderCrateId) return null;
  if (!Number.isInteger(saved.goal) || !Number.isInteger(saved.collected)) return null;
  if (saved.collected < 0 || saved.collected > saved.goal) return null;
  return freeSortTripFrom(saved);
}

// The trip a saved value means in this version, or null when the value is not a
// trip at all. The caller falls back to `createTripPlan` on null.
export function readTrip(saved) {
  if (isValidTripShape(saved)) return freeSortTripFrom(saved);
  return migratedOrderTrip(saved);
}
