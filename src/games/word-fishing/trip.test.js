import { describe, it, expect } from 'vitest';
import {
  CATCHES_PER_TRIP, REEF_REWARDS,
  acceptsWord, crateAcceptsWord, crateForWord, createTripPlan, isValidTripShape, readTrip,
  rewardForTrip, tripComplete, tripRequest, unlockedRewards, withDelivery,
} from './trip.js';
import { CATEGORY_CRATE_IDS, WORD_BANK, crateById } from './words.js';

describe('word-fishing trips', () => {
  it('always deals the free-sorting trip, whatever the trip number', () => {
    // The one-crate order trips of the old cycle are gone: every number gets
    // the same boat, carrying all four crates.
    for (const number of [1, 2, 3, 4, 7, 12]) {
      const trip = createTripPlan(number);
      expect(trip.number).toBe(number);
      expect(trip.kind).toBe('freeSort');
      expect(trip.crates).toEqual(CATEGORY_CRATE_IDS);
      expect(trip.goal).toBe(CATCHES_PER_TRIP);
      expect(trip.collected).toBe(0);
      expect(trip.orderCrateId).toBeNull();
      for (const crateId of trip.crates) expect(crateById(crateId)).toBeTruthy();
    }
    // A nonsense trip number still becomes the first boat.
    expect(createTripPlan(0).number).toBe(1);
    expect(createTripPlan(-3).number).toBe(1);
  });

  it('sends every word into exactly one crate', () => {
    const trip = createTripPlan(1);
    for (const entry of WORD_BANK) {
      const matching = trip.crates.filter((crateId) => crateAcceptsWord(trip, crateId, entry.word));
      expect(matching).toHaveLength(1);
      expect(crateForWord(trip, entry.word)).toBe(matching[0]);
      expect(acceptsWord(trip, entry.word)).toBe(true);
    }
    // Unknown words belong nowhere.
    expect(acceptsWord(trip, 'finnesikke')).toBe(false);
    expect(crateForWord(trip, 'finnesikke')).toBeNull();
    expect(crateAcceptsWord(trip, CATEGORY_CRATE_IDS[0], 'finnesikke')).toBe(false);
  });

  it('counts a catch without ever running past the goal', () => {
    let trip = createTripPlan(1);
    expect(tripComplete(trip)).toBe(false);
    for (let step = 0; step < trip.goal; step += 1) trip = withDelivery(trip);
    expect(trip.collected).toBe(trip.goal);
    expect(tripComplete(trip)).toBe(true);
    expect(withDelivery(trip).collected).toBe(trip.goal);
  });

  it('says out loud what every trip asks for', () => {
    expect(tripRequest()).toMatch(/kassen/i);
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
      const trip = createTripPlan(number);
      expect(isValidTripShape(trip)).toBe(true);
      expect(readTrip(trip)).toEqual(trip);
    }
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
    expect(isValidTripShape({ ...trip, orderCrateId: CATEGORY_CRATE_IDS[0] })).toBe(false);
    expect(readTrip({ ...trip, crates: [CATEGORY_CRATE_IDS[0]] })).toBeNull();
  });

  it('refuses a goal or progress the trip is never dealt with', () => {
    expect(isValidTripShape({ ...createTripPlan(1), goal: 3 })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(1), goal: 0 })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(1), collected: CATCHES_PER_TRIP + 1 })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(1), collected: -1 })).toBe(false);
    expect(isValidTripShape({ ...createTripPlan(1), number: 0 })).toBe(false);
    expect(isValidTripShape(null)).toBe(false);
    expect(isValidTripShape('tur')).toBe(false);
  });

  it('refuses a kind this version no longer deals', () => {
    const trip = createTripPlan(1);
    expect(isValidTripShape({ ...trip, kind: 'order' })).toBe(false);
    expect(isValidTripShape({ ...trip, kind: 'slappe-av' })).toBe(false);
  });

  it('reads an old one-crate order trip back as the free-sorting trip that replaced it', () => {
    const order = {
      number: 4,
      kind: 'order',
      crates: ['nature'],
      goal: 3,
      collected: 2,
      orderCrateId: 'nature',
    };
    expect(isValidTripShape(order)).toBe(false);
    expect(readTrip(order)).toEqual({
      number: 4,
      kind: 'freeSort',
      crates: CATEGORY_CRATE_IDS,
      goal: CATCHES_PER_TRIP,
      collected: 2,
      orderCrateId: null,
    });

    // A shape no old version dealt either is still refused.
    expect(readTrip({ ...order, orderCrateId: 'finnesikke' })).toBeNull();
    expect(readTrip({ ...order, crates: ['nature', 'food'] })).toBeNull();
    expect(readTrip({ ...order, collected: 4 })).toBeNull();
    expect(readTrip({ ...order, number: 0 })).toBeNull();
    expect(readTrip({ ...order, goal: '3' })).toBeNull();
  });
});
