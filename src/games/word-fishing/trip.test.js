import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CATCHES_PER_TRIP, ORDER_TRIP_GOAL, REEF_REWARDS, TRIP_CYCLE,
  acceptsWord, crateAcceptsWord, crateForWord, createTripPlan, isValidTripShape,
  rewardForTrip, tripComplete, tripKindForNumber, tripRequest, unlockedRewards,
  withDelivery,
} from './trip.js';
import { CATEGORY_CRATE_IDS, WORD_BANK, crateById } from './words.js';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('word-fishing trips', () => {
  it('takes one rule at a time, then repeats the cycle', () => {
    expect(TRIP_CYCLE[0]).toBe('freeSort');
    expect(tripKindForNumber(1)).toBe('freeSort');
    expect(tripKindForNumber(TRIP_CYCLE.length + 1)).toBe('freeSort');
    // Only the two rules left are dealt: free sorting and one ordered crate.
    expect(new Set(TRIP_CYCLE)).toEqual(new Set(['freeSort', 'order']));
    for (let number = 1; number <= 12; number += 1) {
      expect(TRIP_CYCLE).toContain(tripKindForNumber(number));
      expect(createTripPlan(number).kind).toBe(tripKindForNumber(number));
    }
  });

  it('opens with all four crates and no order to follow', () => {
    const trip = createTripPlan(1);
    expect(trip.number).toBe(1);
    expect(trip.kind).toBe('freeSort');
    expect(trip.crates).toEqual(CATEGORY_CRATE_IDS);
    expect(trip.goal).toBe(CATCHES_PER_TRIP);
    expect(trip.collected).toBe(0);
    expect(trip.orderCrateId).toBeNull();
    for (const crateId of trip.crates) expect(crateById(crateId)).toBeTruthy();
  });

  it('puts a single ordered crate on the boat on an order trip', () => {
    const trip = createTripPlan(4);
    expect(trip.kind).toBe('order');
    expect(trip.crates).toHaveLength(1);
    expect(trip.orderCrateId).toBe(trip.crates[0]);
    expect(CATEGORY_CRATE_IDS).toContain(trip.orderCrateId);
    expect(trip.goal).toBe(ORDER_TRIP_GOAL);

    const wanted = WORD_BANK.filter((entry) => entry.cat === trip.orderCrateId);
    const other = WORD_BANK.find((entry) => entry.cat !== trip.orderCrateId);
    expect(crateForWord(trip, wanted[0].word)).toBe(trip.orderCrateId);
    expect(acceptsWord(trip, wanted[0].word)).toBe(true);
    // A word of another meaning has nowhere to go today.
    expect(crateForWord(trip, other.word)).toBeNull();
    expect(acceptsWord(trip, other.word)).toBe(false);
    expect(crateAcceptsWord(trip, trip.orderCrateId, other.word)).toBe(false);
  });

  it('sends every word into exactly one crate of every trip kind', () => {
    const trips = [createTripPlan(1), createTripPlan(2), createTripPlan(4)];
    for (const trip of trips) {
      for (const entry of WORD_BANK) {
        const matching = trip.crates.filter((crateId) => crateAcceptsWord(trip, crateId, entry.word));
        if (trip.kind === 'order') {
          expect(matching.length).toBe(entry.cat === trip.orderCrateId ? 1 : 0);
        } else {
          expect(matching).toHaveLength(1);
        }
      }
    }
  });

  it('never orders a category the fishing book already filled', () => {
    const full = CATEGORY_CRATE_IDS[0];
    const open = CATEGORY_CRATE_IDS.filter((crateId) => crateId !== full);
    for (let trial = 0; trial < 20; trial += 1) {
      const trip = createTripPlan(4, () => trial / 20, open);
      expect(trip.orderCrateId).not.toBe(full);
      expect(open).toContain(trip.orderCrateId);
    }
    // One category left: it is the one the boat asks for.
    const only = [CATEGORY_CRATE_IDS[2]];
    expect(createTripPlan(4, () => 0.9, only).orderCrateId).toBe(only[0]);
    // No restriction (the default) still deals every category.
    const seen = new Set(CATEGORY_CRATE_IDS.map((_, index) => createTripPlan(4, () => index / 4).orderCrateId));
    expect(seen).toEqual(new Set(CATEGORY_CRATE_IDS));
  });

  it('counts a catch without ever running past the goal', () => {
    let trip = createTripPlan(1);
    expect(tripComplete(trip)).toBe(false);
    for (let step = 0; step < trip.goal; step += 1) trip = withDelivery(trip);
    expect(trip.collected).toBe(trip.goal);
    expect(tripComplete(trip)).toBe(true);
    expect(withDelivery(trip).collected).toBe(trip.goal);
  });

  it('says out loud what the crew is looking for', () => {
    expect(tripRequest(createTripPlan(1))).toMatch(/kassen/i);
    expect(tripRequest(createTripPlan(2))).toMatch(/kassen/i);
    const order = createTripPlan(4);
    expect(tripRequest(order)).toContain(crateById(order.orderCrateId).label.toLowerCase());
  });
});

describe('word-fishing reef rewards', () => {
  it('unlocks one reef decoration per finished trip, in a fixed order', () => {
    expect(REEF_REWARDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(REEF_REWARDS.map((reward) => reward.id)).size).toBe(REEF_REWARDS.length);
    for (const [index, reward] of REEF_REWARDS.entries()) {
      expect(reward.label.length).toBeGreaterThan(2);
      expect(reward.x).toBeGreaterThan(0);
      expect(reward.x).toBeLessThan(100);
      expect(reward.y).toBeGreaterThan(0);
      expect(reward.y).toBeLessThan(100);
      expect(reward.size).toBeGreaterThan(10);
      expect(rewardForTrip(index + 1)).toBe(reward);
    }
    // Past the end of the list a trip still counts, it just decorates nothing.
    expect(rewardForTrip(REEF_REWARDS.length + 1)).toBeNull();
    expect(rewardForTrip(1)).toBe(REEF_REWARDS[0]);
  });

  it('paints only the decorations this version still knows', () => {
    expect(unlockedRewards([0, 2])).toEqual([REEF_REWARDS[0], REEF_REWARDS[2]]);
    expect(unlockedRewards([0, 99])).toEqual([REEF_REWARDS[0]]);
    expect(unlockedRewards([])).toEqual([]);
  });
});

describe('reading a saved trip back', () => {
  it('accepts every shape the game itself deals', () => {
    for (let number = 1; number <= 8; number += 1) {
      expect(isValidTripShape(createTripPlan(number))).toBe(true);
    }
  });

  it('refuses a trip that does not match its trip number', () => {
    expect(isValidTripShape({ ...createTripPlan(1), kind: 'order' })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(4), kind: 'freeSort' })).toBe(false);
  });

  it('refuses the saved length trip an older version handed out', () => {
    // The short/long trip is gone: a save that still holds one is refused like
    // any other shape this version cannot deal, so a fresh trip is dealt.
    expect(isValidTripShape({
      number: 3,
      kind: 'length',
      crates: ['short', 'long'],
      goal: CATCHES_PER_TRIP,
      collected: 0,
      orderCrateId: null,
    })).toBe(false);
  });

  it('refuses crates the boat could not be carrying', () => {
    const trip = createTripPlan(1);
    expect(isValidTripShape({ ...trip, crates: [] })).toBe(false);
    expect(isValidTripShape({ ...trip, crates: ['finnesikke'] })).toBe(false);
    expect(isValidTripShape({
      ...trip,
      crates: [CATEGORY_CRATE_IDS[0], CATEGORY_CRATE_IDS[0], CATEGORY_CRATE_IDS[1], CATEGORY_CRATE_IDS[2]],
    })).toBe(false);
    expect(isValidTripShape({ ...trip, crates: [CATEGORY_CRATE_IDS[0]] })).toBe(false);
    const order = createTripPlan(4);
    expect(isValidTripShape({ ...order, orderCrateId: null })).toBe(false);
  });

  it('refuses a crate set the kind is never dealt with', () => {
    // A free-sorting trip is dealt all four crates and never fewer, and an
    // order trip is dealt exactly the one crate it asked for – so a saved trip
    // that mismatches its own kind is refused instead of half-understood.
    const free = createTripPlan(1);
    expect(isValidTripShape({ ...free, crates: [CATEGORY_CRATE_IDS[0], CATEGORY_CRATE_IDS[1]] })).toBe(false);
    expect(isValidTripShape({ ...free, crates: [CATEGORY_CRATE_IDS[0]] })).toBe(false);
    expect(isValidTripShape({ ...free, orderCrateId: CATEGORY_CRATE_IDS[0] })).toBe(false);

    const order = createTripPlan(4);
    expect(isValidTripShape({ ...order, crates: [...CATEGORY_CRATE_IDS] })).toBe(false);
    expect(isValidTripShape({ ...order, crates: [CATEGORY_CRATE_IDS[0], CATEGORY_CRATE_IDS[1]] })).toBe(false);
  });

  it('refuses a goal the kind is never dealt with', () => {
    expect(isValidTripShape({ ...createTripPlan(1), goal: ORDER_TRIP_GOAL })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(2), goal: ORDER_TRIP_GOAL })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(4), goal: CATCHES_PER_TRIP })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(4), goal: 0 })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(1), collected: CATCHES_PER_TRIP + 1 })).toBe(false);
  });

  it('refuses impossible progress', () => {
    const trip = createTripPlan(1);
    expect(isValidTripShape({ ...trip, goal: 0 })).toBe(false);
    expect(isValidTripShape({ ...trip, collected: -1 })).toBe(false);
    expect(isValidTripShape({ ...trip, number: 0 })).toBe(false);
    expect(isValidTripShape(null)).toBe(false);
    expect(isValidTripShape('tur')).toBe(false);
  });
});

