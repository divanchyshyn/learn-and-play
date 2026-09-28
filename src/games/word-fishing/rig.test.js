import { describe, it, expect } from 'vitest';
import {
  BAIT_REACH, BITE_TICKS, BOAT_KEY_STEP, BOAT_MAX_X, BOAT_MIN_X, BOAT_SPEED, BOAT_START_X, BOAT_TAP_OFFSET,
  CAST_TICKS, DROP_MAX_DEPTH, DROP_MIN_DEPTH, DROP_SWAY, KEY_TURN_DEGREES, LAND_DISTANCE,
  NIBBLES_MAX, NIBBLES_MIN, NIBBLE_EACH, RIG_DX, WIND_PER_TURN, angleStep, baitReaches, clampBoatX,
  createBait, createBoat, createFight, dropPoint, dropSpot, fightProgress, isSailing, pointerAngle,
  sailTargetForTap, sailTo, startNibble, stepBait, stepBoat, stepFight,
  turnReel,
} from './rig.js';

// An explicit random source: castSpot and startNibble take one so a test never
// has to pin the global.
const always = (value) => () => value;

describe('word-fishing the boat', () => {
  it('starts in place, with nowhere to sail yet', () => {
    const boat = createBoat();
    expect(boat.x).toBe(BOAT_START_X);
    expect(boat.targetX).toBe(BOAT_START_X);
    expect(isSailing(boat)).toBe(false);
    expect(stepBoat(boat)).toBe(boat);
  });

  it('keeps the whole rig inside the sea box', () => {
    expect(clampBoatX(-50)).toBe(BOAT_MIN_X);
    expect(clampBoatX(500)).toBe(BOAT_MAX_X);
    expect(clampBoatX(Number.NaN)).toBe(BOAT_START_X);
    expect(createBoat(500).x).toBe(BOAT_MAX_X);
    // A tap outside the water lands on the nearest spot the rig fits in.
    expect(sailTo(createBoat(), -20).targetX).toBe(BOAT_MIN_X);
    expect(sailTo(createBoat(), 900).targetX).toBe(BOAT_MAX_X);
  });

  it('sails a calm, constant step each tick and stops exactly on the spot', () => {
    const boat = sailTo(createBoat(), BOAT_START_X + 10);
    const first = stepBoat(boat);
    expect(first.x).toBe(BOAT_START_X + BOAT_SPEED);
    expect(isSailing(first)).toBe(true);

    // However far the trip is, it always ends exactly on the target.
    let sailing = first;
    for (let guard = 0; guard < 200 && isSailing(sailing); guard += 1) sailing = stepBoat(sailing);
    expect(sailing.x).toBe(BOAT_START_X + 10);
    expect(stepBoat(sailing)).toBe(sailing);
  });

  it('sails back the other way just as well', () => {
    const away = { x: BOAT_MAX_X, targetX: BOAT_START_X };
    expect(stepBoat(away).x).toBe(BOAT_MAX_X - BOAT_SPEED);
  });

  it('ignores a tap on the spot it is already headed for', () => {
    const boat = sailTo(createBoat(), 40);
    expect(sailTo(boat, 40)).toBe(boat);
    expect(sailTo(boat, 41)).not.toBe(boat);
  });

  it('sails so the rig ends up under the finger that tapped', () => {
    // A tap in the middle of the water puts the boat's own middle there.
    expect(sailTargetForTap(50)).toBe(50 - BOAT_TAP_OFFSET);
    // Taps past the edges are pulled back to where the rig still fits.
    expect(sailTargetForTap(-40)).toBe(BOAT_MIN_X);
    expect(sailTargetForTap(400)).toBe(BOAT_MAX_X);
    expect(sailTargetForTap(Number.NaN)).toBe(BOAT_MIN_X);
    expect(BOAT_KEY_STEP).toBeGreaterThan(BOAT_SPEED);
  });
});

describe('word-fishing putting the line out', () => {
  it('lowers the bait under the boat, wherever the boat is', () => {
    for (let x = BOAT_MIN_X; x <= BOAT_MAX_X; x += 3) {
      const spot = dropSpot(createBoat(x), Math.random);
      // Always in the rod's own column, give or take the small sway.
      expect(Math.abs(spot.x - (x + RIG_DX.rodTip))).toBeLessThanOrEqual(DROP_SWAY);
      expect(spot.y).toBeGreaterThanOrEqual(DROP_MIN_DEPTH);
      expect(spot.y).toBeLessThanOrEqual(DROP_MAX_DEPTH);
    }
  });

  it('always puts the bait in the water, even with the boat against an edge', () => {
    for (const x of [BOAT_MIN_X, BOAT_MAX_X]) {
      for (const random of [always(0), always(0.5), always(0.99)]) {
        const spot = dropSpot(createBoat(x), random);
        expect(spot.x).toBeGreaterThan(3);
        expect(spot.x).toBeLessThan(97);
        // Below the surface the hull floats on, and above the deepest lane.
        expect(spot.y).toBeGreaterThan(24);
        expect(spot.y).toBeLessThan(90);
      }
    }
  });

  it('makes every drop a slightly new place: a small sway and a fresh depth', () => {
    const boat = createBoat(40);
    expect(dropSpot(boat, always(0)).x).toBeCloseTo(40 + RIG_DX.rodTip - DROP_SWAY);
    expect(dropSpot(boat, always(0.99)).x).toBeCloseTo(40 + RIG_DX.rodTip + DROP_SWAY, 1);
    expect(dropSpot(boat, always(0))).not.toEqual(dropSpot(boat, always(0.99)));
    // A deeper drop the more the draw leans that way.
    expect(dropSpot(boat, always(0.5)).y).toBeGreaterThan(dropSpot(boat, always(0)).y);
    expect(dropSpot(boat, always(0.99)).y).toBeGreaterThan(dropSpot(boat, always(0.5)).y);
  });

  it('falls from the rod tip into the water, gathering speed', () => {
    const from = { x: 16, y: 5 };
    const to = { x: 16.4, y: 44 };
    expect(dropPoint(from, to, 0)).toEqual(from);
    const end = dropPoint(from, to, 1);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    // Halfway it is still above the spot it is falling to: it is a drop, not a
    // glide, so the last stretch of the way is the fastest.
    expect(dropPoint(from, to, 0.5).y).toBeLessThan((from.y + to.y) / 2);
    // A stray shape value can never throw the bait out of the sea box.
    expect(dropPoint(from, to, -3)).toEqual(from);
    expect(dropPoint(from, to, 7).y).toBeCloseTo(to.y);
  });
});

describe('word-fishing the bait', () => {
  // Walk the bait from one phase to the next for at most `guard` ticks.
  function tickUntil(bait, phase, guard = 200) {
    let current = bait;
    for (let step = 0; step < guard; step += 1) {
      current = stepBait(current);
      if (current.phase === phase) return current;
    }
    return current;
  }

  it('flies out, then floats in the water waiting for a fish', () => {
    const bait = createBait(30, 40);
    expect(bait.phase).toBe('flying');
    // It is still on its way right up to the last tick of the flight.
    let flying = bait;
    for (let step = 1; step < CAST_TICKS; step += 1) flying = stepBait(flying);
    expect(flying.phase).toBe('flying');
    expect(stepBait(flying).phase).toBe('waiting');
    // Nothing comes to the bait by itself: `waiting` simply counts.
    const waiting = tickUntil(bait, 'waiting');
    expect(stepBait(waiting).phase).toBe('waiting');
    expect(stepBait(waiting).x).toBe(30);
    expect(stepBait(waiting).y).toBe(40);
  });

  it('gives every fish its own small number of nibbles before the bite', () => {
    const bait = createBait(30, 40);
    expect(startNibble(bait, 3, always(0)).nibbles).toBe(NIBBLES_MIN);
    expect(startNibble(bait, 3, always(0.99)).nibbles).toBe(NIBBLES_MAX);
    expect(startNibble(bait, 3).fishId).toBe(3);
  });

  it('turns the last nibble into the strike window, then lets the fish go', () => {
    // One single nibble: the shortest tease the game ever deals.
    let bait = { ...startNibble(createBait(30, 40), 2, always(0)), nibbles: 1 };
    for (let step = 1; step < NIBBLE_EACH; step += 1) {
      bait = stepBait(bait);
      expect(bait.phase).toBe('nibbling');
    }
    bait = stepBait(bait);
    expect(bait.phase).toBe('biting');
    expect(bait.fishId).toBe(2);

    // The float stays under for the whole window…
    for (let step = 1; step < BITE_TICKS; step += 1) {
      bait = stepBait(bait);
      expect(bait.phase).toBe('biting');
    }
    // …and a bite nobody answered is not a loss: the bait is still in the
    // water, waiting for the next fish.
    bait = stepBait(bait);
    expect(bait.phase).toBe('waiting');
    expect(bait.fishId).toBeNull();
    expect(bait.x).toBe(30);
    expect(bait.y).toBe(40);
  });

  it('counts every nibble down before it commits', () => {
    let bait = startNibble(createBait(30, 40), 1, always(0.99)); // NIBBLES_MAX
    let completed = 0;
    let ticks = 0;
    while (bait.phase === 'nibbling' && ticks < 200) {
      const before = bait;
      bait = stepBait(bait);
      ticks += 1;
      if (bait.nibbles < before.nibbles) completed += 1;
    }
    expect(bait.phase).toBe('biting');
    // Every taste ends with the counter dropping – the last one into the bite.
    expect(completed).toBe(NIBBLES_MAX);
    expect(ticks).toBe(NIBBLES_MAX * NIBBLE_EACH);
  });

  it('has nothing to advance once the bait is gone', () => {
    expect(stepBait(null)).toBeNull();
  });
});

describe("word-fishing the bait's reach", () => {
  it('reaches a fish beside the float and lets go of one further along the water', () => {
    const bait = createBait(40, 46);
    // On the float, and right at the edge of the reach either way.
    expect(baitReaches(bait, 40)).toBe(true);
    expect(baitReaches(bait, 40 + BAIT_REACH)).toBe(true);
    expect(baitReaches(bait, 40 - BAIT_REACH)).toBe(true);

    // A fish past the reach swims on: this is what makes sailing to a fish the
    // way to catch one, instead of casting wherever the boat happens to be.
    expect(baitReaches(bait, 40 + BAIT_REACH + 0.1)).toBe(false);
    expect(baitReaches(bait, 40 - BAIT_REACH - 0.1)).toBe(false);
    expect(baitReaches(bait, 100)).toBe(false);
    expect(baitReaches(createBait(15, 32), 106)).toBe(false);
  });

  it('measures from the float itself, and only while a float is in the water', () => {
    const bait = createBait(30, 40);
    // The float hangs off the rod's own column (RIG_DX.rodTip) from the boat's
    // left edge, so the reach is a band around the float, not around the hull.
    expect(baitReaches(bait, 30 + RIG_DX.rodTip)).toBe(true);
    expect(baitReaches(bait, 30 - BAIT_REACH)).toBe(true);

    // No float out is no reach at all, and a column the sea cannot hold is
    // nobody's fish rather than a crash on the way to one.
    expect(baitReaches(null, 30)).toBe(false);
    expect(baitReaches(bait, Number.NaN)).toBe(false);
    expect(baitReaches(bait, undefined)).toBe(false);
  });

  it('is wide enough to aim with and tight enough to matter: about half the screen', () => {
    // The feel of the reach, kept here so a future tweak can see what it breaks.
    const across = BAIT_REACH * 2;
    expect(across).toBeGreaterThanOrEqual(40);
    expect(across).toBeLessThanOrEqual(60);
    // Wider than the rig's own column offset, so the float reaches well past the
    // hull it hangs from.
    expect(BAIT_REACH).toBeGreaterThan(DROP_SWAY);
  });
});

describe('word-fishing the reel', () => {
  it('reads the angle of a finger around the spool centre', () => {
    const centre = { x: 100, y: 100 };
    expect(pointerAngle({ x: 200, y: 100 }, centre)).toBe(0);
    expect(pointerAngle({ x: 100, y: 200 }, centre)).toBe(90);
    expect(pointerAngle({ x: 0, y: 100 }, centre)).toBe(180);
    expect(pointerAngle({ x: 100, y: 0 }, centre)).toBe(-90);
  });

  it('counts a drag across the top as a small step, not a full spin', () => {
    expect(angleStep(10, 40)).toBe(30);
    // The short way round when the finger crosses the top of the spool.
    expect(angleStep(350, 10)).toBe(20);
    expect(angleStep(10, 350)).toBe(-20);
    // And one arrow key press is a sensible quarter of the spool.
    expect(KEY_TURN_DEGREES).toBeGreaterThan(0);
    expect(KEY_TURN_DEGREES).toBeLessThanOrEqual(180);
  });
});

describe('word-fishing the fight', () => {
  it('starts with the fish at the bait and no line to the boat', () => {
    const fight = createFight(7);
    expect(fight).toEqual({ fishId: 7, distance: 0, angle: 0, turned: 0, ticks: 0 });
    expect(fightProgress(fight)).toBe(0);
  });

  it('answers the finger at once: a turn counts before any sea tick', () => {
    const fight = createFight(1);
    const turned = turnReel(fight, 90);
    expect(turned.angle).toBe(90);
    expect(turned.turned).toBe(90);
    // The turn itself does not wind yet: the sea tick turns it into line.
    expect(turned.distance).toBe(0);
    expect(turnReel(turned, 0)).toBe(turned);
    expect(turnReel(turned, Number.NaN)).toBe(turned);
    expect(turnReel(null, 90)).toBeNull();
  });

  it('winds by how far the spool is turned, in either direction', () => {
    const full = stepFight(turnReel(createFight(1), 360)).fight;
    expect(full.distance).toBeCloseTo(WIND_PER_TURN);
    // Half the turn winds half as far, and turning back still pulls the line in.
    expect(stepFight(turnReel(createFight(1), 180)).fight.distance).toBeCloseTo(WIND_PER_TURN / 2);
    expect(stepFight(turnReel(createFight(1), -180)).fight.distance).toBeCloseTo(WIND_PER_TURN / 2);
  });

  it('counts each turn once: the tick clears what the finger turned', () => {
    const wound = stepFight({ ...createFight(1), turned: 360 }).fight;
    expect(wound.turned).toBe(0);
    // With nothing turned, the next tick simply holds the line where it is.
    expect(stepFight(wound).fight.distance).toBe(wound.distance);
  });

  it('holds the fish where it is for as long as the reel is still', () => {
    // A fight is never lost by resting: only winding moves the fish, and a rest
    // neither gives line back nor works the hook loose.
    const resting = { ...createFight(1), distance: 0.5 };
    let fight = resting;
    for (let tick = 0; tick < 60; tick += 1) {
      const step = stepFight(fight);
      fight = step.fight;
      expect(step.ended).toBeNull();
      expect(fight.distance).toBeCloseTo(resting.distance);
    }
  });

  it('lands the fish once it has been wound all the way in', () => {
    const nearly = { ...createFight(1), distance: LAND_DISTANCE - WIND_PER_TURN / 2 };
    const step = stepFight(turnReel(nearly, 360));
    expect(step.ended).toBe('landed');
    expect(step.fight.distance).toBe(LAND_DISTANCE);
  });

  it('never loses the fish, however long the reel is left alone', () => {
    // A fight has one possible ending: the fish comes aboard. Nothing the child
    // does – or leaves undone – can break the line or shake the hook out.
    let fight = createFight(1);
    for (let tick = 0; tick < 200; tick += 1) {
      const step = stepFight(fight);
      expect(step.ended).toBeNull();
      fight = step.fight;
    }
  });

  it('lands the fish for a slow wind as surely as for a fast one', () => {
    // A quarter turn every other tick, far slower than any child would spin:
    // the fish still comes in, and no tick ever ends the fight early.
    let fight = createFight(1);
    let landed = false;
    for (let tick = 0; tick < 120 && !landed; tick += 1) {
      const step = stepFight(tick % 2 === 0 ? turnReel(fight, KEY_TURN_DEGREES) : fight);
      fight = step.fight;
      landed = step.ended === 'landed';
      if (!landed) expect(step.ended).toBeNull();
    }
    expect(landed).toBe(true);
  });

  it('keeps a fight to the things it needs, and counts no miss anywhere', () => {
    const fight = stepFight(turnReel(createFight(1), 360)).fight;
    expect(Object.keys(fight).sort()).toEqual(['angle', 'distance', 'fishId', 'ticks', 'turned']);
  });

  it('paints the fight as a plain 0–1 progress', () => {
    expect(fightProgress({ distance: 0.4 })).toBeCloseTo(0.4);
    expect(fightProgress({ distance: 3 })).toBe(1);
    expect(fightProgress({ distance: -2 })).toBe(0);
    expect(fightProgress(null)).toBe(0);
  });

  // The feel of the fight, kept here so a future tweak can see what it breaks.
  it('is won by a steady wind: about six turns of the reel and the fish is in', () => {
    let fight = createFight(1);
    let ticks = 0;
    let landed = false;
    while (!landed && ticks < 80) {
      const step = stepFight(turnReel(fight, 360));
      fight = step.fight;
      ticks += 1;
      landed = step.ended === 'landed';
    }
    expect(landed).toBe(true);
    // A child's fight: a handful of seconds of turning, never a marathon.
    expect(ticks).toBeGreaterThan(3);
    expect(ticks).toBeLessThan(12);
  });

  it('always lands the fish for a child who simply turns and never stops', () => {
    let fight = createFight(1);
    for (let step = 0; step < 60; step += 1) {
      const next = stepFight(turnReel(fight, 360));
      fight = next.fight;
      if (next.ended) {
        expect(next.ended).toBe('landed');
        return;
      }
    }
    throw new Error('a reel turned forever never landed the fish');
  });
});
