// The fishing rig for Word Fishing: where the boat is, where the bait lies, and
// the fight that brings a hooked fish in. Everything here is pure – no timers,
// no DOM, no sounds, and no knowledge of words – so the whole "how does the boat
// move and how does a fish get into it" question is testable on its own. The sea
// (sea.js) owns the shoal and asks these functions for the boat, the bait and
// the fight.
//
// Design constraints, inherited from the game as a whole:
// - No failure states anywhere. A bite nobody answered and a line that snaps
//   both mean the very same thing: the fish swims on and the child casts again.
//   Nothing here counts a miss, a mistake or a try.
// - Calm, fixed speeds and thresholds – nothing ramps up over time, and the
//   fight is a steady wind on the reel rather than a race against a clock.

// ---------------------------------------------------------------------------
// Where the rig hangs off the boat
// ---------------------------------------------------------------------------
// Percent offsets from the boat's own left edge to the three points that matter:
// where the angler holds the rod, where the rod tip is, and where the net sits on
// deck. The rod is drawn in the scene's line layer and the net in the boat
// drawing, and both hang off these anchors, so neither can ever come loose from
// the angler – whatever the size of the sea. The bait is lowered from the rod
// tip, so `rodTip` is also the column the float ends up in.
export const RIG_DX = { rodBase: 5, rodTip: 14.5, net: 6 };
export const RIG_Y = { rodBase: 13, rodTip: 5, net: 19 };

// ---------------------------------------------------------------------------
// The boat
// ---------------------------------------------------------------------------
// The boat's x is the *left edge* of its drawing, in percent of the sea box –
// exactly what the stylesheet puts in `left`, and the same anchor the old
// fixed-boat scene used (see RIG_DX above). Everything the rig draws (rod base,
// rod tip, the net, the float) hangs a fixed percent offset off that edge, so
// moving the boat moves the whole rig with it and the rod can never come loose
// from the angler, whatever the sea's size.
export const BOAT_MIN_X = 1;
// Far enough right that the whole rig – the hull, the rod and the float below it
// – still fits inside the sea box.
export const BOAT_MAX_X = BOAT_MIN_X + 78;
export const BOAT_START_X = BOAT_MIN_X;
// Percent of the sea box per tick – a calm crossing in a few seconds, never a
// speed boat. Deliberately constant: the sea never gets harder.
export const BOAT_SPEED = 2.6;

export function clampBoatX(x) {
  const value = Number.isFinite(x) ? x : BOAT_START_X;
  return Math.min(BOAT_MAX_X, Math.max(BOAT_MIN_X, value));
}

export function createBoat(x = BOAT_START_X) {
  const left = clampBoatX(x);
  return { x: left, targetX: left };
}

// Sail towards a spot. The target is where the boat's left edge should end up,
// so the whole rig (and the net with it) stays inside the sea box.
export function sailTo(boat, x) {
  const targetX = clampBoatX(x);
  if (targetX === boat.targetX) return boat;
  return { ...boat, targetX };
}

export function isSailing(boat) {
  return boat.x !== boat.targetX;
}

// One tick of sailing. The boat eases in on its target and stops exactly on it,
// so a tap always lands where the child tapped.
export function stepBoat(boat) {
  if (!isSailing(boat)) return boat;
  const left = boat.targetX - boat.x;
  if (Math.abs(left) <= BOAT_SPEED) return { ...boat, x: boat.targetX };
  return { ...boat, x: boat.x + Math.sign(left) * BOAT_SPEED };
}

// A tap on the water lands somewhere along the boat, not at its left edge, so
// the whole rig is nudged back by half its width. The child's finger ends up
// under the angler and the float, which is what they were pointing at.
export const BOAT_TAP_OFFSET = 7;
// How far the arrow keys move the target – a visible hop, never a pixel hunt.
export const BOAT_KEY_STEP = 12;

export function sailTargetForTap(xPercent) {
  const value = Number.isFinite(xPercent) ? xPercent : BOAT_START_X;
  return clampBoatX(value - BOAT_TAP_OFFSET);
}

// ---------------------------------------------------------------------------
// The bait
// ---------------------------------------------------------------------------
// `flying` is the drop itself: the bait is lowered from the rod tip into the
// water right below the boat, so the line hangs straight down from the rod and
// the float floats beside the hull. `waiting` is the float lying there with no
// fish on it yet, `nibbling` is a fish tasting the bait, and `biting` is the
// short moment when the float goes under and the child has to answer. A bite
// nobody answered simply falls back to `waiting`: the bait is still in the
// water, and the next fish will come.
export const BAIT_PHASES = ['flying', 'waiting', 'nibbling', 'biting'];
export const CAST_TICKS = 5; // how long the bait takes to reach the water (~0.6 s)
// A drop is always a new place – the child has just sailed somewhere new – but a
// little sway and a fresh depth keep two drops from looking identical.
export const DROP_SWAY = 1.6; // percent the bait may drift off the rod's column
export const DROP_MIN_DEPTH = 32; // percent of the sea box: below the hull…
export const DROP_MAX_DEPTH = 52; // …and still inside the water every fish swims in
// Nibbles: how many times a fish tastes the bait before it commits, and how
// long each taste lasts. A couple of visible bumps first, so the child can see
// something is about to happen.
export const NIBBLE_EACH = 6;
export const NIBBLES_MIN = 2;
export const NIBBLES_MAX = 3;
// The strike window: the float is under and the child has to answer. Long
// enough for a child to see it and react, short enough to mean something.
export const BITE_TICKS = 11;

export function createBait(x, y) {
  return { x, y, phase: 'flying', ticks: 0, nibbles: 0, fishId: null };
}

// How far the bait can be felt, in percent of the sea box either side of the
// float: a fish only notices the float when it is swimming within this reach of
// it, so where the boat is put is what decides who comes. Roughly half the screen
// across, which is generous on purpose - the child sails to a fish they can see,
// never hunts for a pixel - and measured along the water rather than in a circle,
// because the boat only ever moves along the water: a fish in the deepest lane
// right below the float is as near as one beside the hull, and every lane stays
// catchable from every drop depth.
export const BAIT_REACH = 25;

// Is a fish in this column near enough to the float to notice the bait? The
// float's own column is the measure, not the boat's edge, because the bait is
// what the fish wants.
export function baitReaches(bait, x) {
  return Boolean(bait) && Number.isFinite(x) && Math.abs(x - bait.x) <= BAIT_REACH;
}

// Where the line is lowered: under the boat, in the rod's own column. The sway
// keeps within the water for every spot the boat can be in (see BOAT_MAX_X), so
// the float never ends up on the beach or off the edge of the sea.
export function dropSpot(boat, random = Math.random) {
  const sway = (random() * 2 - 1) * DROP_SWAY;
  const depth = DROP_MIN_DEPTH + random() * (DROP_MAX_DEPTH - DROP_MIN_DEPTH);
  return { x: boat.x + RIG_DX.rodTip + sway, y: depth };
}

// The bait's way down: it falls from the rod tip with a small sway, gathering
// speed as it goes, the way anything dropped does.
export function dropPoint(from, to, t) {
  const shape = Math.min(1, Math.max(0, t));
  return {
    x: from.x + (to.x - from.x) * shape + DROP_SWAY * Math.sin(Math.PI * shape) * 0.5,
    y: from.y + (to.y - from.y) * shape * shape,
  };
}

// A fish has taken an interest: it is now the fish on the bait and it gets its
// own small number of nibbles.
export function startNibble(bait, fishId, random = Math.random) {
  const spread = NIBBLES_MAX - NIBBLES_MIN + 1;
  const nibbles = NIBBLES_MIN + Math.floor(random() * spread);
  return { ...bait, phase: 'nibbling', ticks: 0, nibbles, fishId };
}

// Advance the bait one tick. Every phase change is a plain counter, so the
// scene can line its animations up with the logic instead of guessing.
export function stepBait(bait) {
  if (!bait) return null;
  const ticks = bait.ticks + 1;
  if (bait.phase === 'flying') {
    return ticks < CAST_TICKS ? { ...bait, ticks } : { ...bait, phase: 'waiting', ticks: 0 };
  }
  if (bait.phase === 'nibbling') {
    if (ticks < NIBBLE_EACH) return { ...bait, ticks };
    // One taste fewer; the last one turns into the real bite.
    const nibbles = bait.nibbles - 1;
    return nibbles > 0
      ? { ...bait, ticks: 0, nibbles }
      : { ...bait, phase: 'biting', ticks: 0, nibbles: 0 };
  }
  if (bait.phase === 'biting') {
    // Nobody answered in time: the fish lets go and the bait keeps waiting.
    return ticks < BITE_TICKS ? { ...bait, ticks } : { ...bait, phase: 'waiting', ticks: 0, fishId: null };
  }
  return { ...bait, ticks };
}

// ---------------------------------------------------------------------------
// The fight
// ---------------------------------------------------------------------------
// `distance` runs from 0 (the fish is where it took the bait) to 1 (it is at
// the boat). Turning the reel winds the line in, and that is the whole fight:
// nothing else moves the fish, so a hooked fish is simply wound in. What counts
// is how far the child turns the spool, not how long they press it: `turned`
// collects the degrees turned since the last sea tick, and `angle` is the
// running total the handle on screen is drawn from.
//
// The line can neither break nor go slack – a fish on the line is never lost,
// only brought in – so there is no tension to watch and no bar to read.
// One full 360 degree turn of the reel is the fight's unit of work: a fish takes
// about six calm turns to land, whether the child spins fast or slow.
export const WIND_PER_TURN = 0.165; // distance won per full turn of the reel
export const KEY_TURN_DEGREES = 90; // one arrow key press: a quarter turn
export const LAND_DISTANCE = 1; // at or past this the fish is aboard
// How wide the fish swings about while it is being wound in, in percent of the
// sea box.
export const FIGHT_SWING = 1.5;

export function createFight(fishId) {
  return { fishId, distance: 0, angle: 0, turned: 0, ticks: 0 };
}

// A turn of the reel is its own moment: the spool answers the finger at once,
// and the next sea tick turns the degrees it collected into line wound in.
// Winding is measured by how far the finger travels around the spool, in either
// direction – a child who spins the reel back and forth still pulls the line in.
export function turnReel(fight, degrees) {
  if (!fight || !Number.isFinite(degrees) || degrees === 0) return fight;
  return { ...fight, angle: fight.angle + degrees, turned: fight.turned + Math.abs(degrees) };
}

// How far a finger has moved around the spool since the last pointer event,
// taking the short way round: crossing the 12 o'clock line is a small step,
// never a jump all the way back the other way.
export function angleStep(from, to) {
  return ((to - from + 540) % 360) - 180;
}

// The angle of a point around a centre, in degrees. The reel hands in the
// finger's position and the spool's centre; everything else is arithmetic.
export function pointerAngle(point, centre) {
  return Math.atan2(point.y - centre.y, point.x - centre.x) * (180 / Math.PI);
}

// One tick of the fight. Returns the new fight plus how it ended, if it did:
// 'landed' when the fish is at the boat. A fight has no other ending: the line
// never gives way and the hook never comes loose.
export function stepFight(fight) {
  const next = { ...fight, turned: 0, ticks: fight.ticks + 1 };
  const turns = fight.turned / 360;
  if (turns > 0) next.distance = fight.distance + turns * WIND_PER_TURN;
  if (next.distance >= LAND_DISTANCE) {
    return { fight: { ...next, distance: LAND_DISTANCE }, ended: 'landed' };
  }
  return { fight: next, ended: null };
}

// How far the fight has come, as a plain 0–1 number the scene can paint.
export function fightProgress(fight) {
  if (!fight) return 0;
  return Math.min(1, Math.max(0, fight.distance));
}
