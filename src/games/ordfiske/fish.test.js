import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BUCKET_GOAL, CATCH_TICKS, FISH_ON_SCREEN, LANES, RESUME_TICKS, SPEED_MAX, SPEED_MIN,
  catchFish, createWorld, resetBucket, retryFish, surfaceFish, stepFish, tickWorld,
} from './fish.js';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wordOf(fishIndexInBank) { return fishIndexInBank; }

function activeWords(world) {
  return world.fishes.map((fish) => fish.wordIndex).sort((a, b) => a - b);
}

describe('ordfiske pond setup', () => {
  it('opens with a small shoal of calm, off-stage fish', () => {
    const world = createWorld();
    expect(world.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(world.caught).toBe(0);
    expect(world.celebrating).toBe(false);

    for (const fish of world.fishes) {
      expect(['swim', 'surface', 'caught']).toContain(fish.status);
      expect(fish.speed).toBeGreaterThanOrEqual(SPEED_MIN);
      expect(fish.speed).toBeLessThanOrEqual(SPEED_MAX);
      expect(LANES).toContain(fish.lane);
      expect([1, -1]).toContain(fish.dir);
      // Everyone waits just outside the visible water before drifting in.
      expect(fish.x < 0 || fish.x > 100).toBe(true);
    }
  });

  it('never shows the same word on two fish at once', () => {
    for (let trial = 0; trial < 30; trial += 1) {
      expect(new Set(activeWords(createWorld())).size).toBe(FISH_ON_SCREEN);
    }
  });

  it('stays distinct over a long session full of comings and goings', () => {
    let world = createWorld();
    for (let tick = 0; tick < 800; tick += 1) {
      world = tickWorld(world);
      expect(new Set(activeWords(world)).size).toBe(world.fishes.length);
    }
  });

  it('spreads the opening shoal across different lanes and entry times', () => {
    const world = createWorld();
    expect(new Set(world.fishes.map((fish) => fish.lane)).size).toBe(FISH_ON_SCREEN);
    // Staggered slips: no two fish enter from exactly the same spot.
    const entries = world.fishes.map((fish) => fish.x);
    expect(new Set(entries).size).toBe(FISH_ON_SCREEN);
  });
});

describe('ordfiske movement', () => {
  it('moves swimming fish in their own direction and speed', () => {
    const fish = { id: 1, wordIndex: 0, lane: LANES[0], dir: -1, speed: SPEED_MIN + 0.1, x: 50, status: 'swim', ticksLeft: 0, color: 'coral' };
    const stepped = stepFish(fish);
    expect(stepped.x).toBeCloseTo(50 - (SPEED_MIN + 0.1));
    expect(stepped.status).toBe('swim');
  });

  it('holds surfaced fish perfectly still while they count down', () => {
    let world = createWorld();
    const target = world.fishes[0];
    world = surfaceFish({ ...world, fishes: [{ ...target, x: 40 }, ...world.fishes.slice(1)] }, target.id);

    const xBefore = world.fishes[0].x;
    world = tickWorld(world);
    expect(world.fishes[0].x).toBe(xBefore);
    expect(world.fishes[0].status).toBe('surface');
    expect(world.fishes[0].ticksLeft).toBe(RESUME_TICKS - 1);
  });

  it('replaces a fish that swims away – nothing bad ever happens to it', () => {
    let world = createWorld();
    const leaver = { ...world.fishes[0], dir: 1, x: 120 };
    world = { ...world, fishes: [leaver, ...world.fishes.slice(1)] };

    const next = tickWorld(world);
    expect(next.fishes).toHaveLength(FISH_ON_SCREEN);
    // The leaver is gone; somebody new is already waiting outside the edge.
    expect(next.fishes.some((fish) => fish.id === leaver.id)).toBe(false);
    expect(next.fishes.filter((fish) => fish.x > 100 || fish.x < 0).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the population steady no matter how long the game runs', () => {
    let world = createWorld();
    for (let tick = 0; tick < 2000; tick += 1) {
      world = tickWorld(world);
      expect(world.fishes).toHaveLength(FISH_ON_SCREEN);
    }
  });
});

describe('ordfiske surfacing', () => {
  function surfacedWorld() {
    const base = createWorld();
    return surfaceFish(base, base.fishes[0].id);
  }

  it('surfaces a swimming fish with a fresh countdown', () => {
    const world = surfacedWorld();
    expect(world.fishes[0].status).toBe('surface');
    expect(world.fishes[0].ticksLeft).toBe(RESUME_TICKS);
  });

  it('ignores taps on fish that are not swimming', () => {
    const base = createWorld();
    const caught = catchFish(surfaceFish(base, base.fishes[0].id), base.fishes[0].id);
    expect(surfaceFish(caught, base.fishes[0].id)).toBe(caught); // no change
  });

  it('calmly resumes swimming after the pause – with zero trace', () => {
    let world = surfacedWorld();
    for (let tick = 0; tick < RESUME_TICKS; tick += 1) world = tickWorld(world);

    expect(world.fishes[0].status).toBe('swim');
    expect(world.fishes[0].ticksLeft).toBe(0);
    // No retry/miss counters exist anywhere in the world or its fish.
    expect(Object.keys(world).sort()).toEqual(['caught', 'celebrating', 'fishes', 'order', 'orderPos']);
    expect(Object.keys(world.fishes[0]).sort()).toEqual(['color', 'dir', 'id', 'lane', 'speed', 'status', 'ticksLeft', 'wordIndex', 'x']);
  });

  it('returns straight to the water on 🔁, equally without trace', () => {
    let world = surfacedWorld();
    world = retryFish(world, world.fishes[0].id);
    expect(world.fishes[0].status).toBe('swim');
    expect(world.fishes[0].ticksLeft).toBe(0);
    expect(world.caught).toBe(0);
    expect(world.celebrating).toBe(false);
  });

  it('leaves unknown fish ids untouched', () => {
    const world = createWorld();
    expect(surfaceFish(world, 9999)).toBe(world);
    expect(retryFish(world, 9999)).toBe(world);
  });
});

describe('ordfiske catching', () => {
  it('counts the catch, sends the fish flying, and refills the shoal', () => {
    let world = surfaceFish(createWorld(), createWorld().fishes[0].id);
    world = catchFish(world, world.fishes[0].id);

    expect(world.caught).toBe(1);
    expect(world.celebrating).toBe(false);
    expect(world.fishes[0].status).toBe('caught');

    for (let tick = 0; tick < CATCH_TICKS; tick += 1) world = tickWorld(world);
    expect(world.fishes.some((fish) => fish.status === 'caught')).toBe(false);
    expect(world.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('celebrates exactly when the bucket fills', () => {
    let world = createWorld();
    world = { ...world, caught: BUCKET_GOAL - 1 };
    const first = world.fishes[0];
    world = catchFish(surfaceFish(world, first.id), first.id);
    expect(world.caught).toBe(BUCKET_GOAL);
    expect(world.celebrating).toBe(true);
  });

  it('never counts beyond the goal, even during the celebration', () => {
    let world = { ...createWorld(), caught: BUCKET_GOAL, celebrating: true };
    const other = world.fishes[1];
    world = catchFish(surfaceFish(world, other.id), other.id);
    expect(world.caught).toBe(BUCKET_GOAL);
    expect(world.celebrating).toBe(true);
  });

  it('ignores double catches of the same fish', () => {
    const base = createWorld();
    const once = catchFish(surfaceFish(base, base.fishes[0].id), base.fishes[0].id);
    expect(catchFish(once, base.fishes[0].id)).toBe(once);
  });
});

describe('ordfiske resetting', () => {
  it('empties the bucket but keeps the living pond exactly as it was', () => {
    let world = createWorld();
    world = catchFish(surfaceFish(world, world.fishes[0].id), world.fishes[0].id);
    const emptied = resetBucket(world);

    expect(emptied.caught).toBe(0);
    expect(emptied.celebrating).toBe(false);
    expect(emptied.fishes).toEqual(world.fishes);
    expect(emptied.order).toEqual(world.order);
  });
});

describe('ordfiske invariants', () => {
  it('keeps every promise through a mixed play session', () => {
    let world = createWorld();
    for (let round = 0; round < 6; round += 1) {
      // Let the shoal drift around for a while.
      for (let tick = 0; tick < 60; tick += 1) world = tickWorld(world);
      // Surface one fish, think about it, send it back, catch another.
      world = surfaceFish(world, world.fishes[0].id);
      for (let tick = 0; tick < RESUME_TICKS; tick += 1) world = tickWorld(world);
      world = surfaceFish(world, world.fishes[0].id);
      world = catchFish(world, world.fishes[0].id);
      for (let tick = 0; tick < CATCH_TICKS; tick += 1) world = tickWorld(world);

      expect(world.fishes).toHaveLength(FISH_ON_SCREEN);
      expect(world.caught).toBe(round + 1);
      expect(world.celebrating).toBe(false);
      expect(new Set(activeWords(world)).size).toBe(FISH_ON_SCREEN);
      expect(wordOf(world.orderPos - 1)).toBeDefined();
    }
  });
});
