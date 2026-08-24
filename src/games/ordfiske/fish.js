// Pure fish-pond logic for Ordfiske. Everything here takes a world and
// returns a new world – no timers, no DOM, no sounds. The component drives
// it with one interval tick and renders whatever comes back.
//
// Design constraints from the spec (ordfiske-spec.md):
// - No failure states anywhere: a missed fish just leaves and is replaced,
//   a 🔁 tap is indistinguishable from the fish deciding to swim on, and
//   nothing in the world shape ever counts retries or misses.
// - Calm speeds only – no ramping up over time.

import { pickOne } from '../../shared/random.js';
import { drawWordIndex, pickWordOrder } from './words.js';

export const FISH_ON_SCREEN = 4;
export const BUCKET_GOAL = 8;

// One logic tick; CSS glides each fish for exactly this long so movement
// looks continuous (keep style.css `.fish { transition: left/top … }` in sync).
export const TICK_MS = 120;
export const SURFACE_RESUME_MS = 6000; // a surfaced fish calmly swims on by itself
export const CATCH_FLY_MS = 680; // flight to the bucket before it disappears
export const RESUME_TICKS = Math.max(1, Math.round(SURFACE_RESUME_MS / TICK_MS));
export const CATCH_TICKS = Math.max(1, Math.round(CATCH_FLY_MS / TICK_MS));

// Percent of the pond width per tick – roughly one crossing every 25–35 s.
export const SPEED_MIN = 0.3;
export const SPEED_MAX = 0.55;
export const LANES = [15, 34, 53, 72, 89];
export const FISH_COLORS = ['coral', 'blue', 'ochre', 'green'];

// Where a caught fish lands (percent of pond size) – matches where the
// bucket dock sits on screen.
export const CATCH_POINT = { x: 90, y: 72 };

const EDGE_SLIP_MAX = 10; // extra percent hidden beyond the edge on entry

function spawnFrom(existingFish, order, orderPos, entryOffset = 0) {
  const taken = new Set(existingFish.map((fish) => fish.wordIndex));
  const drawn = drawWordIndex(order, orderPos, taken);
  const freeLanes = LANES.filter((lane) => !existingFish.some((fish) => fish.lane === lane));
  const dir = Math.random() < 0.5 ? -1 : 1;
  const slip = Math.random() * EDGE_SLIP_MAX + entryOffset;
  return {
    fish: {
      id: existingFish.reduce((max, fish) => Math.max(max, fish.id), 0) + 1,
      wordIndex: drawn.index,
      lane: freeLanes.length > 0 ? pickOne(freeLanes) : pickOne(LANES),
      dir,
      speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
      x: dir === -1 ? 106 + slip : -(6 + slip),
      status: 'swim',
      ticksLeft: 0,
      color: FISH_COLORS[(existingFish.length) % FISH_COLORS.length],
    },
    orderPos: drawn.nextPos,
  };
}

function addFish(world, entryOffset = 0) {
  const spawned = spawnFrom(world.fishes, world.order, world.orderPos, entryOffset);
  return { ...world, fishes: [...world.fishes, spawned.fish], orderPos: spawned.orderPos };
}

// A fresh pond: shuffled word order, empty bucket, and a small shoal that
// drifts in staggered so the water comes alive within seconds.
export function createWorld() {
  let world = { fishes: [], order: pickWordOrder(), orderPos: 0, caught: 0, celebrating: false };
  for (let index = 0; index < FISH_ON_SCREEN; index += 1) {
    world = addFish(world, index * 7);
  }
  return world;
}

export function stepFish(fish) {
  if (fish.status === 'swim') return { ...fish, x: fish.x + fish.dir * fish.speed };
  // Surfaced and caught fish stand still while their countdown runs.
  return { ...fish, ticksLeft: fish.ticksLeft - 1 };
}

function isGone(fish) {
  return fish.dir === -1 ? fish.x < -16 : fish.x > 116;
}

// Advance the whole pond one tick. Fish that swim off or finish their flight
// to the bucket are replaced immediately by a new fish waiting just outside
// the edge, so there is always fresh water traffic.
export function tickWorld(world) {
  const survivors = [];
  let departures = 0;

  for (const fish of world.fishes) {
    const stepped = stepFish(fish);
    if (stepped.status === 'swim') {
      if (isGone(stepped)) { departures += 1; continue; }
      survivors.push(stepped);
    } else if (stepped.ticksLeft <= 0) {
      if (stepped.status === 'caught') { departures += 1; continue; }
      // A surfaced fish ran out of audience – back to swimming, no trace.
      survivors.push({ ...stepped, status: 'swim', ticksLeft: 0 });
    } else {
      survivors.push(stepped);
    }
  }

  let fishes = [...survivors];
  let orderPos = world.orderPos;
  for (let index = 0; index < departures; index += 1) {
    const spawned = spawnFrom(fishes, world.order, orderPos);
    fishes = [...fishes, spawned.fish];
    orderPos = spawned.orderPos;
  }

  return { ...world, fishes, orderPos };
}

function withFish(world, fishId, mapFish) {
  let touched = false;
  const fishes = world.fishes.map((fish) => {
    if (fish.id !== fishId) return fish;
    touched = true;
    return mapFish(fish);
  });
  return touched ? { ...world, fishes } : world;
}

function resumeSwimming(fish) {
  return { ...fish, status: 'swim', ticksLeft: 0 };
}

// Tap a swimming fish and it surfaces to show its word.
export function surfaceFish(world, fishId) {
  const fish = world.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status !== 'swim') return world;
  return withFish(world, fishId, () => ({ ...fish, status: 'surface', ticksLeft: RESUME_TICKS }));
}

// ✅ – the player says this one is done. The fish flies to the bucket and a
// replacement waits outside the edge. The bucket count never overshoots the
// goal, even if other surfaced fish are confirmed during the celebration.
export function catchFish(world, fishId) {
  const fish = world.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status === 'caught') return world;
  const caught = Math.min(BUCKET_GOAL, world.caught + 1);
  return {
    ...withFish(world, fishId, (entry) => ({ ...entry, status: 'caught', ticksLeft: CATCH_TICKS })),
    caught,
    celebrating: world.celebrating || caught >= BUCKET_GOAL,
  };
}

// 🔁 – straight back into the shoal. Nothing is recorded anywhere.
export function retryFish(world, fishId) {
  const fish = world.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status !== 'surface') return world;
  return withFish(world, fishId, resumeSwimming);
}

// Empty a full bucket and keep fishing in the same living pond.
export function resetBucket(world) {
  return { ...world, caught: 0, celebrating: false };
}
