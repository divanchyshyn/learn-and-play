import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, FLOAT_POINT, LANES, REEL_STEPS, SPEED_MAX, SPEED_MIN,
  aboardFish, activeFish, createSea, deliverFish, fishPosition, fishWord, hookedFish,
  hookFish, lineTarget, reelFish, slipFish, tickSea,
} from './sea.js';
import { acceptsWord, createTripPlan } from './trip.js';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A first-trip plan: all four crates, so every word the shoal carries can be kept.
const freeSortTrip = () => createTripPlan(1);

function words(sea) {
  return sea.fishes.map((fish) => fish.wordIndex);
}

// Wind a fish all the way in and return the sea with it on deck.
function reelIn(sea, fishId) {
  let next = hookFish(sea, fishId);
  for (let step = 0; step < REEL_STEPS; step += 1) next = reelFish(next, fishId);
  return next;
}

describe('word-fishing sea setup', () => {
  it('opens with a small shoal of calm, off-stage fish', () => {
    const sea = createSea(freeSortTrip());
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(hookedFish(sea)).toBeNull();
    expect(aboardFish(sea)).toBeNull();

    for (const fish of sea.fishes) {
      expect(fish.status).toBe('swim');
      expect(fish.speed).toBeGreaterThanOrEqual(SPEED_MIN);
      expect(fish.speed).toBeLessThanOrEqual(SPEED_MAX);
      expect(LANES).toContain(fish.lane);
      expect([1, -1]).toContain(fish.dir);
      // Everyone waits just outside the visible water before drifting in.
      expect(fishPosition(fish).x < 0 || fishPosition(fish).x > 100).toBe(true);
    }
  });

  it('never shows the same word on two fish at once', () => {
    for (let trial = 0; trial < 30; trial += 1) {
      expect(new Set(words(createSea(freeSortTrip()))).size).toBe(FISH_ON_SCREEN);
    }
  });

  it('stays distinct over a long session full of comings and goings', () => {
    let sea = createSea(freeSortTrip());
    for (let tick = 0; tick < 800; tick += 1) {
      sea = tickSea(sea);
      expect(new Set(words(sea)).size).toBe(sea.fishes.length);
      expect(sea.fishes.length).toBe(FISH_ON_SCREEN);
    }
  });

  it('spreads the opening shoal across different lanes and entry times', () => {
    const sea = createSea(freeSortTrip());
    expect(new Set(sea.fishes.map((fish) => fish.lane)).size).toBe(FISH_ON_SCREEN);
    const entries = sea.fishes.map((fish) => fishPosition(fish).x);
    expect(new Set(entries).size).toBe(FISH_ON_SCREEN);
  });
});

describe('word-fishing movement', () => {
  it('moves swimming fish in their own direction and speed', () => {
    const sea = createSea(freeSortTrip());
    const fish = sea.fishes[0];
    const before = fishPosition(fish).x;
    const moved = tickSea(sea).fishes[0];
    expect(fishPosition(moved).x).toBeCloseTo(before + fish.dir * fish.speed);
    expect(fishPosition(moved).y).toBe(fish.lane);
  });

  it('holds a hooked fish still instead of letting it swim off', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    const hooked = hookedFish(sea);
    expect(hooked.id).toBe(1);
    const after = tickSea(sea);
    expect(fishPosition(hookedFish(after))).toEqual(fishPosition(hooked));
    expect(hookedFish(after).status).toBe('hooked');
  });

  it('replaces every fish that swims away – nothing bad ever happens to it', () => {
    const sea = createSea(freeSortTrip());
    const leaving = { ...sea.fishes[0], x: -17, dir: -1 };
    const next = tickSea({ ...sea, fishes: [leaving, ...sea.fishes.slice(1)] });
    expect(next.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(next.fishes.some((fish) => fish.id === leaving.id)).toBe(false);
    expect(new Set(words(next)).size).toBe(FISH_ON_SCREEN);
  });
});

describe('word-fishing hooking and reeling', () => {
  it('puts a swimming fish on the line when it is tapped', () => {
    const sea = createSea(freeSortTrip());
    const hooked = hookFish(sea, sea.fishes[1].id);
    expect(hookedFish(hooked).id).toBe(sea.fishes[1].id);
    expect(hookedFish(hooked).reelStep).toBe(0);
    expect(activeFish(hooked).id).toBe(sea.fishes[1].id);
  });

  it('ignores taps on a fish that is already busy or unknown', () => {
    const sea = createSea(freeSortTrip());
    const hooked = hookFish(sea, sea.fishes[0].id);
    expect(hookFish(hooked, sea.fishes[0].id)).toBe(hooked);
    expect(hookFish(sea, 9999)).toBe(sea);
    expect(hookFish(sea, sea.fishes[0].id)).not.toBe(sea);
  });

  it('keeps only one fish on the line: hooking another sets the first one free', () => {
    const sea = createSea(freeSortTrip());
    const first = sea.fishes[0].id;
    const second = sea.fishes[2].id;
    const switched = hookFish(hookFish(sea, first), second);
    expect(hookedFish(switched).id).toBe(second);
    const freed = switched.fishes.find((fish) => fish.id === first);
    expect(freed.status).toBe('swim');
    // It carries on exactly where it was swimming.
    expect(fishPosition(freed).x).toBe(sea.fishes[0].x);
  });

  it('will not hook anyone while a catch is still waiting on deck', () => {
    const sea = createSea(freeSortTrip());
    const onDeck = reelIn(sea, sea.fishes[0].id);
    expect(aboardFish(onDeck).id).toBe(sea.fishes[0].id);
    expect(hookFish(onDeck, sea.fishes[1].id)).toBe(onDeck);
  });

  it('winds the fish in one step at a time and lands it on deck', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    let reeled = hookFish(sea, id);
    for (let step = 1; step < REEL_STEPS; step += 1) {
      reeled = reelFish(reeled, id);
      expect(hookedFish(reeled).reelStep).toBe(step);
      expect(hookedFish(reeled).status).toBe('hooked');
    }
    reeled = reelFish(reeled, id);
    expect(aboardFish(reeled).id).toBe(id);
    expect(hookedFish(reeled)).toBeNull();
    // One more tap on the reel changes nothing.
    expect(reelFish(reeled, id)).toBe(reeled);
  });

  it('reels nobody but the hooked fish', () => {
    const sea = createSea(freeSortTrip());
    expect(reelFish(sea, sea.fishes[0].id)).toBe(sea);
    expect(reelFish(sea, 9999)).toBe(sea);
  });

  it('glides a reeled fish from where it was hooked up to the boat', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    const start = { x: sea.fishes[0].x, y: sea.fishes[0].lane };
    const hooked = hookFish(sea, id);
    expect(fishPosition(hookedFish(hooked))).toEqual(start);

    const half = reelFish(reelFish(hooked, id), id);
    const middle = fishPosition(hookedFish(half));
    expect(middle.x).toBeGreaterThan(15.5);
    expect(middle.x).toBeLessThan(start.x);
    expect(middle.y).toBeLessThan(start.y);

    const landed = fishPosition(aboardFish(reelIn(sea, id)));
    expect(landed.x).toBeCloseTo(15.5);
    expect(landed.y).toBeCloseTo(21);
  });

  it('hangs the line on the float until a fish takes it', () => {
    const sea = createSea(freeSortTrip());
    expect(lineTarget(sea)).toEqual(FLOAT_POINT);
    const hooked = hookFish(sea, sea.fishes[0].id);
    expect(lineTarget(hooked)).toEqual(fishPosition(hookedFish(hooked)));
  });
});


describe('word-fishing releasing and delivering', () => {
  it('sends a fish back into the water exactly where it was hooked', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    const spot = { x: sea.fishes[0].x, y: sea.fishes[0].lane };
    const slipped = slipFish(reelIn(sea, id), id);
    const free = slipped.fishes.find((fish) => fish.id === id);
    expect(free.status).toBe('swim');
    expect(free.reelStep).toBe(0);
    expect(fishPosition(free)).toEqual(spot);
    expect(aboardFish(slipped)).toBeNull();
  });

  it('leaves a swimming fish and unknown ids alone', () => {
    const sea = createSea(freeSortTrip());
    expect(slipFish(sea, sea.fishes[0].id)).toBe(sea);
    expect(slipFish(sea, 9999)).toBe(sea);
  });

  it('drops a catch into its crate, then refills the water', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    const delivered = deliverFish(reelIn(sea, id), id, 'animals');
    const fish = delivered.fishes.find((entry) => entry.id === id);
    expect(fish.status).toBe('delivered');
    expect(fish.crateId).toBe('animals');
    expect(aboardFish(delivered)).toBeNull();

    let after = delivered;
    for (let tick = 0; tick < DELIVER_TICKS; tick += 1) after = tickSea(after);
    expect(after.fishes.some((entry) => entry.id === id)).toBe(false);
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('only delivers a fish that is really on deck', () => {
    const sea = createSea(freeSortTrip());
    expect(deliverFish(sea, sea.fishes[0].id, 'animals')).toBe(sea);
    expect(deliverFish(sea, 9999, 'animals')).toBe(sea);
    const aboard = reelIn(sea, sea.fishes[0].id);
    expect(deliverFish(aboard, sea.fishes[0].id, 'animals')).not.toBe(aboard);
  });
});

describe('word-fishing invariants', () => {
  it('keeps every promise through a mixed play session', () => {
    let sea = createSea(freeSortTrip());
    for (let round = 0; round < 8; round += 1) {
      for (let tick = 0; tick < 40; tick += 1) sea = tickSea(sea);
      const target = sea.fishes[0].id;
      sea = hookFish(sea, target);
      for (let step = 0; step < REEL_STEPS; step += 1) sea = reelFish(sea, target);
      sea = deliverFish(sea, target, 'animals');
      for (let tick = 0; tick < DELIVER_TICKS; tick += 1) sea = tickSea(sea);

      expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
      expect(new Set(words(sea)).size).toBe(FISH_ON_SCREEN);
      expect(aboardFish(sea)).toBeNull();
      // Nothing in the sea shape ever counts a miss, a mistake or a try.
      expect(Object.keys(sea).sort()).toEqual(['fishes', 'order', 'orderPos', 'trip']);
      for (const fish of sea.fishes) {
        expect(['swim', 'hooked', 'aboard', 'delivered']).toContain(fish.status);
      }
    }
  });

  it('always leaves a fish worth catching on an ordered trip', () => {
    const orderTrip = createTripPlan(4);
    let sea = createSea(orderTrip);
    for (let tick = 0; tick < 600; tick += 1) {
      sea = tickSea(sea);
      expect(sea.fishes.some((fish) => acceptsWord(orderTrip, fishWord(fish)))).toBe(true);
      expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
    }
  });
});

