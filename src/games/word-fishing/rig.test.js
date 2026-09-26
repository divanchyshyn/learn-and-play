import { describe, it, expect } from 'vitest';
import {
  BITE_TICKS, BOAT_KEY_STEP, BOAT_MAX_X, BOAT_MIN_X, BOAT_SPEED, BOAT_START_X, BOAT_TAP_OFFSET,
  CAST_TICKS, DROP_MAX_DEPTH, DROP_MIN_DEPTH, DROP_SWAY, LAND_DISTANCE, LET_OUT, NIBBLES_MAX, NIBBLES_MIN,
  NIBBLE_EACH, REEL_RATE, RIG_DX, SLACK_TENSION, SLACK_TICKS, SNAP_TENSION, TENSION_DANGER, TENSION_FALL,
  TENSION_NEAR, TENSION_RISE, clampBoatX, createBait, createBoat, createFight, dropPoint, dropSpot,
  fightProgress, isSailing, sailTargetForTap, sailTo, setHolding, startNibble, stepBait,
  stepBoat, stepFight, tensionLevel,
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

describe('word-fishing the fight', () => {
  it('starts with the fish at the bait and no line to the boat', () => {
    const fight = createFight(7);
    expect(fight).toEqual({ fishId: 7, distance: 0, tension: 0, slack: 0, holding: false, ticks: 0 });
    expect(fightProgress(fight)).toBe(0);
    // A line nobody holds is slack from the start, not safe.
    expect(tensionLevel(fight.tension)).toBe('slack');
  });

  it('answers the finger at once: pressed and released without a sea tick', () => {
    const fight = createFight(1);
    const pressed = setHolding(fight, true);
    expect(pressed.holding).toBe(true);
    expect(pressed.distance).toBe(0);
    expect(setHolding(pressed, true)).toBe(pressed);
    expect(setHolding(pressed, false).holding).toBe(false);
    expect(setHolding(null, true)).toBeNull();
  });

  it('winds the fish in and tightens the line while the crank is held', () => {
    const step = stepFight(createFight(1), true);
    expect(step.ended).toBeNull();
    expect(step.fight.distance).toBeCloseTo(REEL_RATE);
    expect(step.fight.tension).toBeCloseTo(TENSION_RISE);
  });

  it('eases the line and loses a little of it when the crank is let go', () => {
    const strained = { ...createFight(1), distance: 0.5, tension: 0.5 };
    const eased = stepFight(strained, false).fight;
    expect(eased.tension).toBeCloseTo(0.5 - TENSION_FALL);
    expect(eased.distance).toBeCloseTo(0.5 - LET_OUT);
  });

  it('never lets tension or distance fall below zero', () => {
    const fresh = stepFight(createFight(1), false).fight;
    expect(fresh.tension).toBe(0);
    expect(fresh.distance).toBe(0);
  });

  it('lands the fish once it has been wound all the way in', () => {
    const nearly = { ...createFight(1), distance: LAND_DISTANCE - REEL_RATE / 2 };
    const step = stepFight(nearly, true);
    expect(step.ended).toBe('landed');
    expect(step.fight.distance).toBe(LAND_DISTANCE);
  });

  it('snaps the line when it is left taut for too long', () => {
    const nearly = { ...createFight(1), tension: SNAP_TENSION - TENSION_RISE / 2 };
    const step = stepFight(nearly, true);
    expect(step.ended).toBe('snapped');
    expect(step.fight.tension).toBe(SNAP_TENSION);
  });

  it('checks the snap first: holding on as the fish arrives still breaks the line', () => {
    const both = {
      ...createFight(1),
      distance: LAND_DISTANCE - REEL_RATE / 2,
      tension: SNAP_TENSION - TENSION_RISE / 2,
    };
    expect(stepFight(both, true).ended).toBe('snapped');
  });

  it('warns the child before the line gives way', () => {
    expect(tensionLevel(0)).toBe('slack');
    expect(tensionLevel(SLACK_TENSION)).toBe('slack');
    expect(tensionLevel(SLACK_TENSION + 0.01)).toBe('safe');
    expect(tensionLevel(TENSION_NEAR - 0.01)).toBe('safe');
    expect(tensionLevel(TENSION_NEAR)).toBe('near');
    expect(tensionLevel(TENSION_DANGER)).toBe('danger');
  });

  it('lets the fish throw the hook when the line is left slack', () => {
    // Twenty ticks of a line nobody pulls on: about two and a half seconds.
    let fight = createFight(1);
    let ticks = 0;
    let thrown = false;
    for (let step = 0; step < 80 && !thrown; step += 1) {
      const next = stepFight(fight, false);
      fight = next.fight;
      ticks += 1;
      thrown = next.ended === 'thrown';
    }
    expect(thrown).toBe(true);
    expect(ticks).toBe(SLACK_TICKS);
    expect(fight.slack).toBe(SLACK_TICKS);
  });

  it('keeps the slack clock at zero while the line is really being worked', () => {
    // Two good turns of the crank lift the line out of the slack band…
    let fight = createFight(1);
    for (let tick = 0; tick < 3; tick += 1) fight = stepFight(fight, true).fight;
    expect(fight.tension).toBeGreaterThan(SLACK_TENSION);
    expect(fight.slack).toBe(0);
    // …and the moment the child winds again after an ease, the clock is back at
    // zero. Only a line left lying slack ever reaches the throw.
    fight = stepFight(fight, false).fight;
    fight = stepFight(fight, true).fight;
    expect(fight.slack).toBe(0);
  });

  it('paints the fight as a plain 0–1 progress', () => {
    expect(fightProgress({ distance: 0.4 })).toBeCloseTo(0.4);
    expect(fightProgress({ distance: 3 })).toBe(1);
    expect(fightProgress({ distance: -2 })).toBe(0);
    expect(fightProgress(null)).toBe(0);
  });

  // The feel of the fight, kept here so a future tweak can see what it breaks.
  it('is won by a steady pump: hold, ease before the red, hold again', () => {
    let fight = createFight(1);
    let ticks = 0;
    let landed = false;
    for (let cycle = 0; cycle < 12 && !landed; cycle += 1) {
      // Hold while there is room on the line, easing off before the red…
      while (fight.tension < TENSION_NEAR && !landed) {
        const step = stepFight(fight, true);
        fight = step.fight;
        ticks += 1;
        landed = step.ended === 'landed';
      }
      // …and ease only until the line is comfortable, never into the slack.
      while (fight.tension > TENSION_NEAR - 0.2 && !landed) {
        const step = stepFight(fight, false);
        fight = step.fight;
        ticks += 1;
        landed = step.ended === 'landed';
      }
    }
    expect(landed).toBe(true);
    // A child's fight: a handful of seconds of real pumping, never a marathon.
    expect(ticks).toBeGreaterThan(20);
    expect(ticks).toBeLessThan(120);
  });

  it('keeps a properly pumped fight well clear of the slack band', () => {
    // The pump above has to work without ever risking a thrown hook.
    let fight = createFight(1);
    let worstSlack = 0;
    for (let cycle = 0; cycle < 6; cycle += 1) {
      while (fight.tension < TENSION_NEAR) {
        fight = stepFight(fight, true).fight;
      }
      while (fight.tension > TENSION_NEAR - 0.2) {
        fight = stepFight(fight, false).fight;
      }
      worstSlack = Math.max(worstSlack, fight.slack);
    }
    expect(worstSlack).toBe(0);
  });

  it('lets the line break for a child who simply holds on', () => {
    let fight = createFight(1);
    for (let step = 0; step < 60; step += 1) {
      const next = stepFight(fight, true);
      fight = next.fight;
      if (next.ended) {
        expect(next.ended).toBe('snapped');
        return;
      }
    }
    throw new Error('a line held forever never snapped');
  });
});
