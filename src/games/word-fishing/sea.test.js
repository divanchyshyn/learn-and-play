import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, FLOAT_POINT, GRIP_TICKS, HOOK_LANDING, LANES, REEL_STEPS,
  SAG_MAX, SPEED_MAX, SPEED_MIN, STRUGGLE_SWING,
  aboardFish, activeFish, canHookFish, createSea, deliverFish, fishPosition, fishWord, hookedFish,
  hookFish, lineTarget, reelFish, slipFish, tickSea,
} from './sea.js';
import { acceptsWord, createTripPlan } from './trip.js';
import { WORD_BANK } from './words.js';

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

  it('keeps a hooked fish from drifting off, but lets it fight in place', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    const hooked = hookedFish(sea);
    expect(hooked.id).toBe(1);
    expect(hooked.reelStep).toBe(0);
    expect(hooked.grip).toBe(1);

    const after = tickSea(sea);
    const stillHooked = hookedFish(after);
    // It never drifts off along its lane while it is on the line…
    expect(stillHooked.status).toBe('hooked');
    expect(stillHooked.x).toBe(hooked.x);
    // …but it is not a parcel either: the line loosens and it thrashes about.
    expect(stillHooked.grip).toBeLessThan(hooked.grip);
    expect(stillHooked.struggle).toBe(hooked.struggle + 1);
    expect(fishPosition(stillHooked)).not.toEqual(fishPosition(hooked));
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

describe('word-fishing the fight on the line', () => {
  it('loses its hold tick by tick, and every turn of the reel wins it back', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    let reeled = sea;
    for (let tick = 0; tick < 8; tick += 1) reeled = tickSea(reeled);
    const drained = hookedFish(reeled).grip;
    expect(drained).toBeLessThan(1);
    expect(drained).toBeCloseTo(1 - 8 / GRIP_TICKS, 5);

    // One tap and the line bites again.
    const gripped = reelFish(reeled, 1);
    expect(hookedFish(gripped).grip).toBe(1);
    expect(hookedFish(gripped).reelStep).toBe(1);
  });

  it('slips further back towards open water the less hold the line has', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    const spot = { x: sea.fishes[0].x, y: sea.fishes[0].lane };
    // Two turns in, so the fish has something to lose.
    let reeled = reelFish(reelFish(sea, 1), 1);
    const taut = fishPosition(hookedFish(reeled));

    for (let tick = 0; tick < GRIP_TICKS - 1; tick += 1) reeled = tickSea(reeled);
    const loose = fishPosition(hookedFish(reeled));

    // Both positions slide back towards the very spot it was hooked in.
    expect(loose.x).toBeGreaterThan(taut.x);
    expect(loose.x).toBeLessThanOrEqual(spot.x);
    expect(Math.abs(loose.x - spot.x)).toBeLessThan(Math.abs(taut.x - spot.x));
    // A fish slips back at most SAG_MAX of the way, never past the hook point.
    expect(spot.x - loose.x).toBeLessThanOrEqual(SAG_MAX * (spot.x - HOOK_LANDING.x) + STRUGGLE_SWING);
  });

  it('thrashes about while it hangs on the line, and stops once it is on deck', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    const seen = new Set();
    let reeled = sea;
    for (let tick = 0; tick < 6; tick += 1) {
      reeled = tickSea(reeled);
      const spot = fishPosition(hookedFish(reeled));
      seen.add(`${spot.x.toFixed(2)},${spot.y.toFixed(2)}`);
    }
    // Every tick puts it somewhere new – it is alive, not parked.
    expect(seen.size).toBe(6);

    const landed = fishPosition(aboardFish(reelIn(sea, 1)));
    expect(landed.x).toBeCloseTo(HOOK_LANDING.x);
    expect(landed.y).toBeCloseTo(HOOK_LANDING.y);
  });

  it('lets a fish break free when nobody keeps the line taut', () => {
    const sea = hookFish(createSea(freeSortTrip()), 1);
    expect(hookedFish(sea).reelStep).toBe(0);

    let sea2 = sea;
    for (let tick = 0; tick < GRIP_TICKS; tick += 1) sea2 = tickSea(sea2);

    // A real possibility, deliberately: the hook came loose on its own.
    expect(hookedFish(sea2)).toBeNull();
    const escaped = sea2.fishes.find((fish) => fish.id === 1);
    expect(escaped.status).toBe('swim');
    expect(escaped.escaped).toBe(true);
    expect(escaped.reelStep).toBe(0);
    // It slips back into the water at the very spot it was hooked in.
    expect(fishPosition(escaped)).toEqual({ x: sea.fishes[0].x, y: sea.fishes[0].lane });
    // The splash lasts exactly one tick, and the fish swims on afterwards.
    const later = tickSea(sea2);
    expect(later.fishes.find((fish) => fish.id === 1).escaped).toBe(false);
    expect(later.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('always lands a fish for a child who keeps tapping in time', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    let reeled = hookFish(sea, id);
    // Keep tapping with a short pause between turns – the child never loses it.
    for (let step = 0; step < REEL_STEPS; step += 1) {
      for (let tick = 0; tick < Math.floor(GRIP_TICKS / 2); tick += 1) {
        reeled = tickSea(reeled);
        expect(hookedFish(reeled)).not.toBeNull();
      }
      reeled = reelFish(reeled, id);
    }
    expect(aboardFish(reeled).id).toBe(id);
  });

  it('never lets go of a fish that is already on deck or in a crate', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    const onDeck = reelIn(sea, id);
    let after = onDeck;
    for (let tick = 0; tick < GRIP_TICKS * 3; tick += 1) after = tickSea(after);
    expect(aboardFish(after).id).toBe(id);

    let delivered = deliverFish(onDeck, id, 'animals');
    for (let tick = 0; tick < DELIVER_TICKS; tick += 1) delivered = tickSea(delivered);
    expect(delivered.fishes.some((fish) => fish.escaped)).toBe(false);
  });
});


describe('word-fishing releasing and delivering', () => {
  it('says whether a new fish may be hooked at all', () => {
    const sea = createSea(freeSortTrip());
    // Nothing on deck: the shoal is open for business.
    expect(canHookFish(sea)).toBe(true);
    expect(canHookFish(hookFish(sea, sea.fishes[0].id))).toBe(true);

    // A catch on deck is the task at hand – nobody new can be hooked, and hooking
    // anyone else changes nothing at all.
    const onDeck = reelIn(sea, sea.fishes[0].id);
    expect(canHookFish(onDeck)).toBe(false);
    const other = onDeck.fishes.find((fish) => fish.status === 'swim');
    expect(hookFish(onDeck, other.id)).toBe(onDeck);
    expect(hookedFish(hookFish(onDeck, other.id))).toBeNull();

    // Let it go (or crate it) and the shoal answers again.
    expect(canHookFish(slipFish(onDeck, sea.fishes[0].id))).toBe(true);
    expect(canHookFish(deliverFish(onDeck, sea.fishes[0].id, 'animals'))).toBe(true);
  });

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

  it('sends a replacement in the moment a catch lands in its crate', () => {
    const sea = createSea(freeSortTrip());
    const id = sea.fishes[0].id;
    const delivered = deliverFish(reelIn(sea, id), id, 'animals');

    // The caught fish is still sinking, and the water is already full again.
    expect(delivered.fishes.filter((fish) => fish.status === 'delivered')).toHaveLength(1);
    expect(delivered.fishes.filter((fish) => fish.status === 'swim')).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(words(delivered)).size).toBe(delivered.fishes.length);

    let after = delivered;
    for (let tick = 0; tick < DELIVER_TICKS; tick += 1) after = tickSea(after);
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(after.fishes.every((fish) => fish.status === 'swim')).toBe(true);
  });

  it('only delivers a fish that is really on deck', () => {
    const sea = createSea(freeSortTrip());
    expect(deliverFish(sea, sea.fishes[0].id, 'animals')).toBe(sea);
    expect(deliverFish(sea, 9999, 'animals')).toBe(sea);
    const aboard = reelIn(sea, sea.fishes[0].id);
    expect(deliverFish(aboard, sea.fishes[0].id, 'animals')).not.toBe(aboard);
  });
});

describe('word-fishing the fishing book', () => {
  it('never lets a caught word back into the water', () => {
    const sea = createSea(freeSortTrip());
    const first = sea.fishes[0];
    const caughtWord = fishWord(first);
    let after = deliverFish(reelIn(sea, first.id), first.id, 'animals');

    // Long enough for several shoals to come and go. The fish sinking into the
    // crate is the catch itself; no *swimming* fish may ever carry the word.
    for (let tick = 0; tick < 1200; tick += 1) {
      after = tickSea(after);
      expect(after.fishes.some((fish) => fish.status !== 'delivered' && fishWord(fish) === caughtWord)).toBe(false);
    }
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('never deals a word the book already has', () => {
    const caught = new Set(WORD_BANK.map((entry) => entry.word).slice(0, 70));
    let sea = createSea(freeSortTrip(), caught);
    for (let tick = 0; tick < 1200; tick += 1) {
      sea = tickSea(sea);
      for (const fish of sea.fishes) expect(caught.has(fishWord(fish))).toBe(false);
    }
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('lets the shoal run down when there is no uncaught word left', () => {
    // Every word is in the book: no fish may be dealt, caught words included.
    const caught = new Set(WORD_BANK.map((entry) => entry.word));
    let sea = createSea(freeSortTrip(), caught);
    expect(sea.fishes).toHaveLength(0);
    for (let tick = 0; tick < 200; tick += 1) sea = tickSea(sea);
    expect(sea.fishes).toHaveLength(0);
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
      expect(Object.keys(sea).sort()).toEqual(['caught', 'fishes', 'order', 'orderPos', 'trip']);
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

