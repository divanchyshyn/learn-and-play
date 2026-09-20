// The living sea for Word Fishing. Everything here takes a sea and returns a
// new sea – no timers, no DOM, no sounds. The component drives it with one
// interval tick and renders whatever comes back.
//
// Design constraints:
// - No failure states anywhere: a fish that swims off the edge is replaced by a
//   new arrival, a fish the crew cannot keep is simply released back into the
//   water, and nothing anywhere counts misses, mistakes or tries.
// - Calm speeds only – they never ramp up over time.
// - One fish on the line at a time, and nobody can be hooked while a catch is
//   still waiting on deck.

import { pickOne } from '../../shared/random.js';
import { drawWordIndex, drawWordIndexWhere, pickWordOrder, WORD_BANK } from './words.js';
import { acceptsWord } from './trip.js';

export const FISH_ON_SCREEN = 5;

// One logic tick; CSS glides each fish for exactly this long so movement looks
// continuous (keep the `.fish` transition in style.css in sync).
export const TICK_MS = 120;
// How long a delivered fish stays visible while it sinks into its crate.
export const DELIVER_MS = 620;
export const DELIVER_TICKS = Math.max(1, Math.round(DELIVER_MS / TICK_MS));
// Taps needed to wind a hooked fish up to the boat.
export const REEL_STEPS = 4;
// A hooked fish is not a parcel: it fights. `grip` is how well the line still
// holds it, and it drains away tick by tick – every turn of the reel wins it
// back. Twenty ticks is about 2.4 seconds, so a child who keeps tapping always
// lands the fish while one who stops to think about something else can really
// lose it. Deliberately tuned to be a real possibility, never a punishment: a
// fish that gets away simply swims on, and can be hooked again at once.
export const GRIP_TICKS = 20;
export const SLACK_PER_TICK = 1 / GRIP_TICKS;
// While it is hauled in, the fish thrashes about – and the less grip it has, the
// wider it swings. Both are percentages of the sea box.
export const STRUGGLE_SWING = 1.7;
// How far back towards open water a fish slips while the line goes slack.
export const SAG_MAX = 0.42;

// Percent of the sea box per tick – roughly one crossing every 30 seconds.
export const SPEED_MIN = 0.3;
export const SPEED_MAX = 0.55;

// The lanes a fish may swim in (percent of the sea box height), the waterline
// the scene paints, and where the fishing rig sits. Exported so the scene
// artwork and the stylesheet line up with the logic instead of guessing.
export const LANES = [36, 45, 54, 63, 72, 81];
export const WATERLINE = 22;
// The rod is drawn in the scene's line layer, from where the angler's hands are
// to the tip the line hangs from, so the rod and the line always meet.
export const ROD_BASE = { x: 6, y: 13 };
export const ROD_TIP = { x: 15.5, y: 5 };
export const FLOAT_POINT = { x: 15.5, y: 23 };
// Where a reeled-in fish arrives: on deck, right at the waterline beside the rod.
export const HOOK_LANDING = { x: 15.5, y: 21 };
export const FISH_COLORS = ['coral', 'blue', 'ochre', 'green', 'plum'];

const EDGE_SLIP_MAX = 10; // extra percent hidden beyond the edge on entry

export function fishWord(fish) {
  return WORD_BANK[fish.wordIndex].word;
}

function reach(from, to, t) {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// Percent coordinates for painting one fish. A swimming fish is simply where it
// swims. A fish on the line is hauled from the spot where it was hooked towards
// the boat – and it fights the whole way: the less grip the line has, the further
// it slips back towards open water, and while it hangs on it thrashes about, so
// it is never a parcel sliding quietly up a wire. `reelStep` is how far the haul
// has come, `grip` is how hard the line still holds, and `struggle` ticks on so
// the thrashing keeps moving.
export function fishPosition(fish) {
  if (fish.status === 'swim') return { x: fish.x, y: fish.lane };
  const hooked = { x: fish.hookX, y: fish.hookY };
  const haul = Math.min(1, fish.reelStep / REEL_STEPS);
  const sag = SAG_MAX * (1 - Math.min(1, Math.max(0, fish.grip)));
  const pulled = reach(reach(hooked, HOOK_LANDING, haul), hooked, sag);
  if (fish.status !== 'hooked') return pulled;
  // Thrashing is widest in the moment the line is almost lost. Both offsets are
  // sine waves, so the very moment the hook bites the fish is exactly where it
  // was swimming – it never jumps.
  const swing = STRUGGLE_SWING * (1 - 0.45 * (1 - fish.grip));
  return {
    x: pulled.x + swing * Math.sin(fish.struggle * 0.8),
    y: pulled.y + swing * 0.7 * Math.sin(fish.struggle * 1.25),
  };
}


function spawnFrom(fishes, order, orderPos, trip, entryOffset = 0) {
  const taken = new Set(fishes.map((fish) => fish.wordIndex));
  const acceptsIndex = (index) => acceptsWord(trip, WORD_BANK[index].word);
  // There is always at least one fish worth catching: while nobody in the shoal
  // counts towards this trip, the arriving fish is drawn from the words that do.
  const mustYield = !fishes.some((fish) => acceptsIndex(fish.wordIndex));
  const drawn = mustYield
    ? drawWordIndexWhere(order, orderPos, taken, acceptsIndex)
    : drawWordIndex(order, orderPos, taken);
  const freeLanes = LANES.filter((lane) => !fishes.some((fish) => fish.lane === lane));
  const dir = Math.random() < 0.5 ? -1 : 1;
  const slip = Math.random() * EDGE_SLIP_MAX + entryOffset;
  return {
    fish: {
      id: fishes.reduce((max, fish) => Math.max(max, fish.id), 0) + 1,
      wordIndex: drawn.index,
      lane: freeLanes.length > 0 ? pickOne(freeLanes) : pickOne(LANES),
      dir,
      speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
      x: dir === -1 ? 106 + slip : -(6 + slip),
      status: 'swim',
      ticksLeft: 0,
      reelStep: 0,
      grip: 0,
      struggle: 0,
      escaped: false,
      hookX: 0,
      hookY: 0,
      crateId: null,
      color: FISH_COLORS[fishes.length % FISH_COLORS.length],
    },
    orderPos: drawn.nextPos,
  };
}

function addFish(sea, entryOffset = 0) {
  const spawned = spawnFrom(sea.fishes, sea.order, sea.orderPos, sea.trip, entryOffset);
  return { ...sea, fishes: [...sea.fishes, spawned.fish], orderPos: spawned.orderPos };
}

// A fresh sea for one trip: a shuffled word order and a small shoal that drifts
// in staggered, so the water comes alive within seconds.
export function createSea(trip) {
  let sea = { trip, fishes: [], order: pickWordOrder(), orderPos: 0 };
  for (let index = 0; index < FISH_ON_SCREEN; index += 1) sea = addFish(sea, index * 7);
  return sea;
}

export function hookedFish(sea) {
  return sea.fishes.find((fish) => fish.status === 'hooked') ?? null;
}

export function aboardFish(sea) {
  return sea.fishes.find((fish) => fish.status === 'aboard') ?? null;
}

// The fish the child is busy with, whether it is still on the line or already
// waiting on deck.
export function activeFish(sea) {
  return hookedFish(sea) ?? aboardFish(sea);
}

// Where the fishing line should end right now: on the hooked fish, or on the
// float when the rod is simply waiting.
export function lineTarget(sea) {
  const fish = activeFish(sea);
  return fish ? fishPosition(fish) : FLOAT_POINT;
}

function stepFish(fish) {
  if (fish.status === 'swim') return { ...fish, x: fish.x + fish.dir * fish.speed, escaped: false };
  if (fish.status === 'hooked') {
    // The line slowly loses its hold, and the fish keeps thrashing.
    return { ...fish, grip: Math.max(0, fish.grip - SLACK_PER_TICK), struggle: fish.struggle + 1 };
  }
  if (fish.status === 'delivered') return { ...fish, ticksLeft: fish.ticksLeft - 1 };
  // A catch waiting on deck never drifts away.
  return fish;
}

// The line has lost its hold: the hook comes loose and the fish is free again.
// It keeps the exact spot it was hooked in, so it slips back into the water
// where it came from instead of teleporting.
function breakFree(fish) {
  return freeSwimmer({ ...fish, grip: 0, struggle: 0 }, true);
}

function isGone(fish) {
  return fish.dir === -1 ? fish.x < -16 : fish.x > 116;
}

// Advance the whole sea one tick. Fish that swim off or finish sinking into
// their crate are replaced immediately by a new arrival waiting just outside
// the edge, so there is always fresh water traffic.
export function tickSea(sea) {
  const survivors = [];
  let departures = 0;

  for (const fish of sea.fishes) {
    const stepped = stepFish(fish);
    if (stepped.status === 'hooked' && stepped.grip <= 0) {
      // Nobody kept the line taut, so the fish wins this round and swims on.
      survivors.push(breakFree(stepped));
    } else if (stepped.status === 'swim') {
      if (isGone(stepped)) { departures += 1; continue; }
      survivors.push(stepped);
    } else if (stepped.status === 'delivered' && stepped.ticksLeft <= 0) {
      departures += 1;
    } else {
      survivors.push(stepped);
    }
  }

  let fishes = [...survivors];
  let orderPos = sea.orderPos;
  for (let index = 0; index < departures; index += 1) {
    const spawned = spawnFrom(fishes, sea.order, orderPos, sea.trip);
    fishes = [...fishes, spawned.fish];
    orderPos = spawned.orderPos;
  }

  return { ...sea, fishes, orderPos };
}

function freeSwimmer(fish, escaped = false) {
  return {
    ...fish,
    status: 'swim',
    ticksLeft: 0,
    reelStep: 0,
    grip: 0,
    struggle: 0,
    escaped,
    hookX: 0,
    hookY: 0,
    crateId: null,
  };
}

function mapFish(sea, fishId, mapEntry) {
  return { ...sea, fishes: sea.fishes.map((fish) => (fish.id === fishId ? mapEntry(fish) : fish)) };
}

// Tap a swimming fish to put it on the line. A fish already on the line calmly
// slips free first, and while a catch is waiting on deck nobody new is hooked –
// so there is never more than one fish to think about.
export function hookFish(sea, fishId) {
  if (aboardFish(sea)) return sea;
  const target = sea.fishes.find((fish) => fish.id === fishId);
  if (!target || target.status !== 'swim') return sea;
  const fishes = sea.fishes.map((fish) => {
    if (fish.status === 'hooked') return freeSwimmer(fish);
    if (fish.id !== fishId) return fish;
    return { ...fish, status: 'hooked', reelStep: 0, grip: 1, struggle: 0, escaped: false, hookX: fish.x, hookY: fish.lane };
  });
  return { ...sea, fishes };
}

// One turn of the reel: the fish comes a step closer, and the line bites again.
// It lands on deck on the last one.
export function reelFish(sea, fishId) {
  const fish = sea.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status !== 'hooked') return sea;
  const reelStep = Math.min(REEL_STEPS, fish.reelStep + 1);
  return mapFish(sea, fishId, (entry) => ({
    ...entry,
    reelStep,
    grip: 1,
    status: reelStep >= REEL_STEPS ? 'aboard' : 'hooked',
  }));
}

// Release a catch back into the water – every bit as ordinary as catching one.
// Used both for the child's own change of heart and for a fish no crate wants.
// Nothing is recorded anywhere, and the fish keeps the exact spot it was hooked.
export function slipFish(sea, fishId) {
  const fish = sea.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status === 'swim' || fish.status === 'delivered') return sea;
  return mapFish(sea, fishId, freeSwimmer);
}

// Drop a catch into a crate. The fish sinks down into it and a new arrival takes
// its place in the water.
export function deliverFish(sea, fishId, crateId) {
  const fish = sea.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status !== 'aboard') return sea;
  return mapFish(sea, fishId, (entry) => ({
    ...entry,
    status: 'delivered',
    crateId,
    ticksLeft: DELIVER_TICKS,
  }));
}

