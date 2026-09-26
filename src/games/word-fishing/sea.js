// The living sea for Word Fishing. Everything here takes a sea and returns a
// new sea – no timers, no DOM, no sounds. The component drives it with one
// interval tick and renders whatever comes back; the boat, the bait and the
// fight themselves live in rig.js, and this module is where they meet the fish.
//
// Design constraints:
// - No failure states anywhere: a fish that swims off the edge is replaced by a
//   new arrival, a bite nobody answered and a line that snapped both simply
//   mean the fish swims on, a fish the crew cannot keep is released back into
//   the water, and nothing anywhere counts misses, mistakes or tries.
// - Calm speeds only – they never ramp up over time.
// - One fish on the line at a time, and nobody can be tempted while a catch is
//   still waiting on deck.

import { pickOne } from '../../shared/random.js';
import {
  CAST_TICKS, FIGHT_SWING, RIG_DX, RIG_Y, createBait, createBoat, createFight, dropPoint, dropSpot,
  sailTo, setHolding, startNibble, stepBait, stepBoat, stepFight,
} from './rig.js';
import { drawWordIndexWhere, pickWordOrder, WORD_BANK } from './words.js';
import { acceptsWord } from './trip.js';

export const FISH_ON_SCREEN = 5;

// One logic tick; CSS glides each fish for exactly this long so movement looks
// continuous (keep the `.fish` transition in style.css in sync).
export const TICK_MS = 120;
// How long a delivered fish stays visible while it sinks into its crate.
export const DELIVER_MS = 620;
export const DELIVER_TICKS = Math.max(1, Math.round(DELIVER_MS / TICK_MS));
// How long a fish takes to swim from wherever it is to the bait, once it has
// taken an interest: fast enough to feel like something is about to happen,
// slow enough to watch the fish arrive.
export const CHASE_TICKS = 9;
// How long the float lies still in the water before a fish is drawn to it, so
// every cast is seen to land before anything else happens.
export const OFFER_TICKS = 6;

// Percent of the sea box per tick – roughly one crossing every 30 seconds.
export const SPEED_MIN = 0.3;
export const SPEED_MAX = 0.55;

// The lanes a fish may swim in (percent of the sea box height), the waterline
// the scene paints, and where the rig sits. The whole rig hangs off the boat's
// own left edge and its geometry lives with the boat and the bait (see RIG_DX in
// rig.js), so the rod, the float and the net travel with it and the rod can never
// come loose from the angler.
export const LANES = [36, 45, 54, 63, 72, 81];
export const WATERLINE = 22;
export const FISH_COLORS = ['coral', 'blue', 'ochre', 'green', 'plum'];

// The rig's points for one boat position, in percent of the sea box. The rod is
// drawn in the scene's line layer from where the angler's hands are to the tip
// the line hangs from, so the rod and the line always meet.
export function rodBasePoint(boat) {
  return { x: boat.x + RIG_DX.rodBase, y: RIG_Y.rodBase };
}

export function rodTipPoint(boat) {
  return { x: boat.x + RIG_DX.rodTip, y: RIG_Y.rodTip };
}

// The net on deck: where a fish arrives once the fight is won, and the spot a
// fish slips back into the water from when it is let go.
export function netPoint(boat) {
  return { x: boat.x + RIG_DX.net, y: RIG_Y.net };
}

const EDGE_SLIP_MAX = 10; // extra percent hidden beyond the edge on entry
const HOME_BOAT = createBoat();

export function fishWord(fish) {
  return WORD_BANK[fish.wordIndex].word;
}

function reach(from, to, t) {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// A fish gliding to the bait starts and stops smoothly instead of snapping off
// its lane, and the float's own jiggle keeps moving with the same tick counter.
function smoothstep(t) {
  const shape = Math.min(1, Math.max(0, t));
  return shape * shape * (3 - 2 * shape);
}

function nearestLane(y) {
  return LANES.reduce((best, lane) => (Math.abs(lane - y) < Math.abs(best - y) ? lane : best), LANES[0]);
}

// Percent coordinates for painting one fish. A swimming fish is simply where it
// swims; one that has taken an interest glides to the bait and jostles it; one
// on the line is hauled from the spot where it took the bait towards the boat's
// net, and it fights the whole way – the tighter the line, the wider it
// thrashes (`tension` is mirrored from the fight each tick, `struggle` is a
// plain tick counter that keeps the thrashing moving).
export function fishPosition(fish, boat = null) {
  if (fish.status === 'swim') return { x: fish.x, y: fish.lane };
  if (fish.status === 'chasing') {
    const t = smoothstep(fish.chaseT);
    return reach(fish.chaseFrom, fish.chaseTo, t);
  }
  if (fish.status === 'nibbling' || fish.status === 'biting') {
    // The float is knocked about gently while the fish tastes the bait, and
    // properly rattled in the moment of the bite.
    const amp = fish.status === 'biting' ? 1.8 : 0.9;
    return {
      x: fish.chaseTo.x + amp * Math.sin(fish.struggle * 0.9),
      y: fish.chaseTo.y + amp * 0.7 * Math.sin(fish.struggle * 1.3),
    };
  }
  // Hooked, aboard or already delivered: the fish is on the line from the spot
  // it took the bait to the net, as far along as the fight has come.
  const net = netPoint(boat ?? HOME_BOAT);
  const hauled = reach({ x: fish.hookX, y: fish.hookY }, net, fish.distance ?? 0);
  if (fish.status !== 'hooked') return hauled;
  const swing = FIGHT_SWING * (0.35 + 0.65 * (fish.tension ?? 0));
  return {
    x: hauled.x + swing * Math.sin(fish.struggle * 0.8),
    y: hauled.y + swing * 0.7 * Math.sin(fish.struggle * 1.25),
  };
}

// Where the float is right now: on its way down from the rod tip it falls into
// the water, and the rest of the time it simply floats where it landed.
export function baitPosition(sea) {
  if (!sea.bait) return null;
  if (sea.bait.phase === 'flying') {
    const tip = rodTipPoint(sea.boat);
    const spot = { x: sea.bait.x, y: sea.bait.y };
    return dropPoint(tip, spot, sea.bait.ticks / CAST_TICKS);
  }
  return { x: sea.bait.x, y: sea.bait.y };
}


function spawnFrom(fishes, order, orderPos, trip, unavailable, entryOffset = 0) {
  const taken = new Set(fishes.map((fish) => fish.wordIndex));
  const isUnavailable = (index) => unavailable.has(WORD_BANK[index].word);
  // A word the book already has – or whose crate has reached its target – never
  // swims again, so it is not a catch at all.
  const keepable = (index) => !isUnavailable(index) && acceptsWord(trip, WORD_BANK[index].word);
  // There is always at least one fish worth catching: while nobody in the shoal
  // counts towards this trip, the arriving fish is drawn from the words that do.
  const mustYield = !fishes.some((fish) => keepable(fish.wordIndex));
  const drawn = drawWordIndexWhere(order, orderPos, taken, mustYield ? keepable : (index) => !isUnavailable(index));
  if (drawn.index === null) return { fish: null, orderPos: drawn.nextPos };
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
      // Where it was and where it is headed once it takes an interest in the
      // bait, and how far along that swim it is.
      chaseFrom: null,
      chaseTo: null,
      chaseT: 0,
      // How far the fight has come and how tight the line is – mirrored from
      // the fight each tick so the scene can paint one fish from one object.
      distance: 0,
      tension: 0,
      struggle: 0,
      escaped: false,
      thrown: false,
      spat: false,
      hookX: 0,
      hookY: 0,
      crateId: null,
      color: FISH_COLORS[fishes.length % FISH_COLORS.length],
    },
    orderPos: drawn.nextPos,
  };
}

function addFish(sea, entryOffset = 0) {
  const spawned = spawnFrom(sea.fishes, sea.order, sea.orderPos, sea.trip, sea.unavailable, entryOffset);
  if (!spawned.fish) return sea;
  return { ...sea, fishes: [...sea.fishes, spawned.fish], orderPos: spawned.orderPos };
}

// A fresh sea for one trip: a shuffled word order, the words that may not swim
// (everything in the fishing book, and everything whose crate is already full),
// a small shoal that drifts in staggered so the water comes alive within
// seconds, and an empty boat ready to sail.
export function createSea(trip, unavailable = new Set()) {
  let sea = {
    trip,
    unavailable,
    fishes: [],
    order: pickWordOrder(),
    orderPos: 0,
    boat: createBoat(),
    bait: null,
    fight: null,
  };
  for (let index = 0; index < FISH_ON_SCREEN; index += 1) sea = addFish(sea, index * 7);
  return sea;
}

export function hookedFish(sea) {
  return sea.fishes.find((fish) => fish.status === 'hooked') ?? null;
}

export function aboardFish(sea) {
  return sea.fishes.find((fish) => fish.status === 'aboard') ?? null;
}

// The fish the bait has tempted: the one swimming over to it, tasting it, or
// hanging on it in the moment of the bite.
export function baitFish(sea) {
  if (!sea.bait || !sea.bait.fishId) return null;
  return sea.fishes.find((fish) => fish.id === sea.bait.fishId) ?? null;
}

// The fish the child is busy with: the one on the line, the catch waiting on
// deck, or the one the bait has tempted.
export function activeFish(sea) {
  return hookedFish(sea) ?? aboardFish(sea) ?? baitFish(sea);
}

// Where the fishing line should end right now: on the fish being fought, or on
// the float while the rod simply waits. `null` means no line is in the water.
export function lineTarget(sea) {
  const fish = hookedFish(sea);
  if (fish) return fishPosition(fish, sea.boat);
  return baitPosition(sea);
}

// May the boat sail? Not while the line is out: it holds its spot until the
// bait has been pulled up, so a cast is never dragged around the sea. A catch
// waiting on deck counts too – the reading task comes first.
export function canSail(sea) {
  return !sea.bait && !sea.fight && !aboardFish(sea);
}

// May a line be cast? From a free boat only, and never while a catch is still
// waiting on deck.
export function canCastBait(sea) {
  return !sea.bait && !sea.fight && !aboardFish(sea);
}

// Is the float under right now – the one moment a strike does anything at all?
export function canStrike(sea) {
  return Boolean(sea.bait)
    && sea.bait.phase === 'biting'
    && Boolean(sea.bait.fishId)
    && !sea.fight
    && !aboardFish(sea);
}

export function canPullIn(sea) {
  return Boolean(sea.bait);
}

function stepFish(fish) {
  if (fish.status === 'swim') {
    // A swimming fish keeps its lane, and the one-tick marks of whatever
    // happened to it last tick are wiped away here.
    return { ...fish, x: fish.x + fish.dir * fish.speed, escaped: false, thrown: false, spat: false };
  }
  if (fish.status === 'chasing') {
    // The swim over to the bait: one fixed share of the way each tick, so the
    // glide always takes the same calm while, whatever the distance.
    return { ...fish, chaseT: Math.min(1, fish.chaseT + 1 / CHASE_TICKS), struggle: fish.struggle + 1 };
  }
  if (fish.status === 'delivered') return { ...fish, ticksLeft: fish.ticksLeft - 1 };
  // Nibbling, biting, on the line or waiting on deck: the fish keeps jostling,
  // and where it is follows from the bait, the net and the fight.
  return { ...fish, struggle: fish.struggle + 1 };
}

// A fish let go back into the water. It swims on from the spot it was at, in
// the lane closest to it, free of the bait and the fight. `flag` marks the
// one-tick splash the scene answers with: 'escaped' for a line that gave way,
// 'thrown' for a hook a slack line let it shake out, 'spat' for a bait it let go
// of, and nothing at all for a line pulled up.
function returnToSwim(fish, spot, flag) {
  return {
    ...fish,
    status: 'swim',
    x: spot.x,
    lane: nearestLane(spot.y),
    ticksLeft: 0,
    chaseFrom: null,
    chaseTo: null,
    chaseT: 0,
    distance: 0,
    tension: 0,
    struggle: 0,
    escaped: flag === 'escaped',
    thrown: flag === 'thrown',
    spat: flag === 'spat',
    hookX: 0,
    hookY: 0,
    crateId: null,
  };
}

function isGone(fish) {
  return fish.dir === -1 ? fish.x < -16 : fish.x > 116;
}

// Which fish comes to the bait? One whose word this trip wants, first of all,
// so a waiting child is never kept from a catch that counts; failing that –
// every swimmer carrying a word with nowhere to go – any swimmer, which can
// always be let go again, exactly as before.
function pickTempted(fishes, sea) {
  const swimmers = fishes.filter((fish) => fish.status === 'swim');
  if (swimmers.length === 0) return null;
  const keepable = swimmers.filter((fish) => acceptsWord(sea.trip, fishWord(fish)));
  return pickOne(keepable.length > 0 ? keepable : swimmers);
}

// Advance the whole sea one tick: the boat sails, the shoal swims, the float
// waits and is tasted, the fight is fought, and every fish that leaves the
// water is replaced at once so the sea is never empty.
export function tickSea(sea) {
  const boat = stepBoat(sea.boat);
  let fishes = sea.fishes.map((fish) => stepFish(fish));
  let bait = sea.bait;
  let fight = sea.fight;

  // The float's own clock: it flies out, lies still, is tasted, and is bitten.
  const biter = bait ? bait.fishId : null;
  const wasBiting = Boolean(bait) && bait.phase === 'biting';
  if (bait) bait = stepBait(bait);
  if (wasBiting && bait.phase === 'waiting' && biter !== null) {
    // Nobody answered the bite in time: the fish lets go of the bait and swims
    // on, and the float keeps waiting for the next one. Nothing is counted.
    const spot = { x: bait.x, y: bait.y };
    fishes = fishes.map((fish) => (fish.id === biter ? returnToSwim(fish, spot, 'spat') : fish));
  }

  // Something in the shoal notices the bait and comes over for it.
  if (bait && bait.phase === 'waiting' && !bait.fishId && bait.ticks >= OFFER_TICKS) {
    const tempted = pickTempted(fishes, sea);
    if (tempted) {
      bait = { ...bait, fishId: tempted.id };
      const chaseFrom = { x: tempted.x, y: tempted.lane };
      const chaseTo = { x: bait.x, y: bait.y };
      fishes = fishes.map((fish) => (fish.id === tempted.id
        ? { ...fish, status: 'chasing', chaseFrom, chaseTo, chaseT: 0, struggle: 0 }
        : fish));
    }
  }

  // Having arrived at the bait, the fish starts tasting it.
  const arrival = fishes.find((fish) => fish.status === 'chasing' && fish.chaseT >= 1);
  if (bait && bait.phase === 'waiting' && arrival) {
    bait = startNibble(bait, arrival.id, Math.random);
    fishes = fishes.map((fish) => (fish.id === arrival.id ? { ...fish, status: 'nibbling', struggle: 0 } : fish));
  }
  // The fish on the bait follows the float's own phase, so the two can never
  // drift apart: nibbling, biting, and the bite going under.
  if (bait && bait.fishId && (bait.phase === 'nibbling' || bait.phase === 'biting')) {
    fishes = fishes.map((fish) => (fish.id === bait.fishId && fish.status !== bait.phase
      ? { ...fish, status: bait.phase }
      : fish));
  }

  // The fight: the child's crank against the fish.
  if (fight) {
    const step = stepFight(fight, fight.holding);
    fight = step.fight;
    // Mirror the fight onto the fish, so the scene paints one fish from one
    // object – how far it has come, and how tight the line is.
    fishes = fishes.map((fish) => (fish.id === fight.fishId
      ? { ...fish, distance: fight.distance, tension: fight.tension }
      : fish));
    if (step.ended === 'landed') {
      // In the net: the reading task takes over from here.
      fishes = fishes.map((fish) => (fish.id === fight.fishId
        ? { ...fish, status: 'aboard', distance: 1, tension: 0, struggle: 0 }
        : fish));
      fight = null;
    } else if (step.ended === 'snapped') {
      // The line gave way. The fish slips back into the water where it was,
      // with a splash, and the child is free to cast again at once.
      const target = fishes.find((fish) => fish.id === fight.fishId);
      const spot = target ? fishPosition(target, boat) : { x: boat.x, y: 45 };
      fishes = fishes.map((fish) => (fish.id === fight.fishId ? returnToSwim(fish, spot, 'escaped') : fish));
      fight = null;
    } else if (step.ended === 'thrown') {
      // The line was left slack, so the fish shook the hook out. Same friendly
      // ending as a broken line: it swims on, and the line can go out again.
      const target = fishes.find((fish) => fish.id === fight.fishId);
      const spot = target ? fishPosition(target, boat) : { x: boat.x, y: 45 };
      fishes = fishes.map((fish) => (fish.id === fight.fishId ? returnToSwim(fish, spot, 'thrown') : fish));
      fight = null;
    }
  }

  // A fish that swims off the edge is replaced immediately by a new arrival
  // waiting just outside it, and so is one whose word was taken out of play in
  // the meantime – say, its crate reached its target while it was swimming – so
  // the water never carries a fish that can no longer be kept. A fish that was
  // delivered was already replaced the moment it landed (see deliverFish), so
  // it only sinks out of sight here.
  const survivors = [];
  let departures = 0;
  for (const fish of fishes) {
    if (fish.status === 'delivered') {
      if (fish.ticksLeft > 0) survivors.push(fish);
      continue;
    }
    if (fish.status === 'swim' && (isGone(fish) || sea.unavailable.has(fishWord(fish)))) {
      departures += 1;
      continue;
    }
    survivors.push(fish);
  }

  let nextFishes = [...survivors];
  let orderPos = sea.orderPos;
  for (let index = 0; index < departures; index += 1) {
    const spawned = spawnFrom(nextFishes, sea.order, orderPos, sea.trip, sea.unavailable);
    if (spawned.fish) nextFishes = [...nextFishes, spawned.fish];
    orderPos = spawned.orderPos;
  }

  return { ...sea, boat, fishes: nextFishes, bait, fight, orderPos };
}

function mapFish(sea, fishId, mapEntry) {
  return { ...sea, fishes: sea.fishes.map((fish) => (fish.id === fishId ? mapEntry(fish) : fish)) };
}

// Sail towards a spot. Nothing happens while the line is out: the boat holds
// its place until the bait is pulled up, so a cast is never dragged about the
// sea. (The scene answers a tap that cannot sail with a gentle nudge, so a tap
// that does nothing is never mistaken for the game ignoring the child.)
export function sailBoat(sea, x) {
  if (!canSail(sea)) return sea;
  const boat = sailTo(sea.boat, x);
  return boat === sea.boat ? sea : { ...sea, boat };
}

// Cast the line out. The bait is lowered from the rod tip into the water right
// under the boat, the boat stops where it is – a line is put out from a spot, not
// on the move – and the water starts waiting for a fish to take an interest.
export function castBait(sea) {
  if (!canCastBait(sea)) return sea;
  const boat = { ...sea.boat, targetX: sea.boat.x };
  const spot = dropSpot(boat, Math.random);
  return { ...sea, boat, bait: createBait(spot.x, spot.y) };
}

// Pull the line up again: the bait comes out of the water, and the fish that
// was after it simply swims on from where it was. Used both by the child's own
// change of mind and by a boat that wants to sail somewhere else.
export function pullInBait(sea) {
  if (!sea.bait) return sea;
  const spot = { x: sea.bait.x, y: sea.bait.y };
  const fishes = sea.bait.fishId
    ? sea.fishes.map((fish) => (fish.id === sea.bait.fishId ? returnToSwim(fish, spot, null) : fish))
    : sea.fishes;
  return { ...sea, fishes, bait: null };
}

// Strike: the float goes under and the child answers in time. The fish is on
// the line, and the fight begins from the very spot where it took the bait.
export function strikeFish(sea) {
  if (!canStrike(sea)) return sea;
  const fishId = sea.bait.fishId;
  const fishes = sea.fishes.map((fish) => (fish.id === fishId
    ? {
      ...fish,
      status: 'hooked',
      hookX: sea.bait.x,
      hookY: sea.bait.y,
      chaseFrom: null,
      chaseTo: null,
      chaseT: 0,
      distance: 0,
      tension: 0,
      struggle: 0,
      escaped: false,
      thrown: false,
      spat: false,
    }
    : fish));
  return { ...sea, fishes, bait: null, fight: createFight(fishId) };
}

// Hold or release the crank – its own moment, so the button answers the finger
// at once. The next sea tick then winds the fish in or lets the line out.
export function setReelHold(sea, holding) {
  if (!sea.fight) return sea;
  const fight = setHolding(sea.fight, holding);
  return fight === sea.fight ? sea : { ...sea, fight };
}

// Release a catch back into the water – every bit as ordinary as catching one.
// Used both for the child's own change of heart and for a fish no crate wants.
// Nothing is recorded anywhere: the fish slips off the deck and swims on.
export function slipFish(sea, fishId) {
  const fish = sea.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status === 'swim' || fish.status === 'delivered') return sea;
  return mapFish(sea, fishId, (entry) => returnToSwim(entry, netPoint(sea.boat), null));
}

// Drop a catch into a crate. The fish sinks down into it, and a replacement
// swims in at that very moment, so the child never looks at an emptying sea.
// The delivered word joins the words that may not swim again; `outOfPlay` may
// add more of them at the same moment – the words a just-filled crate leaves
// behind, for instance – so the next arrival already respects them.
export function deliverFish(sea, fishId, crateId, outOfPlay = []) {
  const fish = sea.fishes.find((entry) => entry.id === fishId);
  if (!fish || fish.status !== 'aboard') return sea;
  const unavailable = new Set(sea.unavailable);
  unavailable.add(fishWord(fish));
  for (const word of outOfPlay) unavailable.add(word);
  const fishes = sea.fishes.map((entry) => (entry.id === fishId
    ? { ...entry, status: 'delivered', crateId, ticksLeft: DELIVER_TICKS }
    : entry));
  const spawned = spawnFrom(fishes, sea.order, sea.orderPos, sea.trip, unavailable);
  return {
    ...sea,
    unavailable,
    fishes: spawned.fish ? [...fishes, spawned.fish] : fishes,
    orderPos: spawned.orderPos,
  };
}

